import JSZip from "jszip";

import type { DeckDocument, SlideElement } from "../types";

const PPT_MAIN_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

type RelationshipMap = Map<string, string>;

function parseXml(xmlText: string) {
  return new DOMParser().parseFromString(xmlText, "application/xml");
}

function childElements(parent: Element, localName: string, deep = false) {
  const nodes = deep ? parent.getElementsByTagName("*") : parent.children;
  return Array.from(nodes).filter((node): node is Element => {
    return node instanceof Element && node.localName === localName;
  });
}

function readTextNodes(element: Element) {
  return Array.from(element.getElementsByTagNameNS(DRAWING_NS, "t"))
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);
}

function readShapeBox(element: Element, slideWidth: number, slideHeight: number) {
  const xfrm = childElements(element, "xfrm", true)[0];
  const off = xfrm ? childElements(xfrm, "off")[0] : undefined;
  const ext = xfrm ? childElements(xfrm, "ext")[0] : undefined;

  const x = Number(off?.getAttribute("x") ?? 0);
  const y = Number(off?.getAttribute("y") ?? 0);
  const cx = Number(ext?.getAttribute("cx") ?? slideWidth);
  const cy = Number(ext?.getAttribute("cy") ?? slideHeight);

  return {
    x: x / slideWidth,
    y: y / slideHeight,
    width: cx / slideWidth,
    height: cy / slideHeight,
  };
}

function readSolidFill(element: Element) {
  const solidFill = childElements(element, "solidFill", true)[0];
  const rgb = solidFill ? childElements(solidFill, "srgbClr")[0] : undefined;
  return rgb?.getAttribute("val") ? `#${rgb.getAttribute("val")}` : "#ffffff";
}

async function readRelationships(zip: JSZip, path: string) {
  const file = zip.file(path);
  if (!file) {
    return new Map<string, string>();
  }

  const xml = parseXml(await file.async("text"));
  const map = new Map<string, string>();
  const rels = Array.from(xml.getElementsByTagNameNS("*", "Relationship"));

  rels.forEach((rel) => {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) {
      map.set(id, target);
    }
  });

  return map;
}

function guessMimeType(path: string) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function imageDataUrl(zip: JSZip, target: string) {
  const normalized = target.replace(/^..\//, "");
  const file = zip.file(`ppt/${normalized}`) ?? zip.file(normalized);
  if (!file) {
    return "";
  }

  const base64 = await file.async("base64");
  return `data:${guessMimeType(target)};base64,${base64}`;
}

function collectWarnings(xml: Document) {
  const warnings = new Set<string>();
  const hasTag = (name: string) => xml.getElementsByTagNameNS("*", name).length > 0;

  if (hasTag("anim") || hasTag("transition")) {
    warnings.add("Animations and transitions are not rendered in the browser playback.");
  }
  if (hasTag("graphicFrame")) {
    warnings.add("Charts, tables, or SmartArt may be simplified during playback.");
  }
  if (hasTag("video") || hasTag("audio")) {
    warnings.add("Embedded audio/video is not supported in v1 playback.");
  }

  return Array.from(warnings);
}

async function parseNotes(zip: JSZip, rels: RelationshipMap, relPath: string) {
  const noteRel = Array.from(rels.entries()).find(([, target]) => target.includes("notesSlides"));
  if (!noteRel) {
    return undefined;
  }

  const [, target] = noteRel;
  const base = relPath.replace("ppt/slides/_rels/", "ppt/slides/");
  const baseUrl = new URL(base, "https://ppt.local/");
  const notePath = new URL(target, baseUrl).pathname.replace(/^\//, "");
  const file = zip.file(notePath);

  if (!file) {
    return undefined;
  }

  const xml = parseXml(await file.async("text"));
  const texts = Array.from(xml.getElementsByTagNameNS(DRAWING_NS, "t"))
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);

  return texts.length > 0 ? texts.join("\n") : undefined;
}

export async function parsePptxFile(file: File): Promise<DeckDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");

  if (!presentationXml) {
    throw new Error("Invalid PPTX file: missing presentation.xml");
  }

  const presentation = parseXml(presentationXml);
  const sizeNode = presentation.getElementsByTagNameNS(PPT_MAIN_NS, "sldSz")[0];
  const slideWidth = Number(sizeNode?.getAttribute("cx") ?? 9144000);
  const slideHeight = Number(sizeNode?.getAttribute("cy") ?? 5143500);
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => {
      const aNum = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const bNum = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return aNum - bNum;
    });

  const deckWarnings = new Set<string>();
  const slides = [];

  for (const [index, path] of slidePaths.entries()) {
    const xmlText = await zip.file(path)?.async("text");
    if (!xmlText) {
      continue;
    }

    const xml = parseXml(xmlText);
    collectWarnings(xml).forEach((warning) => deckWarnings.add(warning));
    const relPath = path.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
    const rels = await readRelationships(zip, relPath);
    const background = readSolidFill(xml.documentElement);
    const elements: SlideElement[] = [];

    for (const shape of Array.from(xml.getElementsByTagNameNS(PPT_MAIN_NS, "sp"))) {
      const box = readShapeBox(shape, slideWidth, slideHeight);
      const paragraphs = readTextNodes(shape);
      const fontNode = shape.getElementsByTagNameNS(DRAWING_NS, "defRPr")[0] ?? shape.getElementsByTagNameNS(DRAWING_NS, "rPr")[0];
      const fontSize = Number(fontNode?.getAttribute("sz") ?? 2200) / 100;
      const color = readSolidFill(shape);
      const alignNode = shape.getElementsByTagNameNS(DRAWING_NS, "pPr")[0];
      const align = (alignNode?.getAttribute("algn") as "left" | "center" | "right" | null) ?? "left";

      if (paragraphs.length > 0) {
        elements.push({
          id: crypto.randomUUID(),
          type: "text",
          ...box,
          paragraphs,
          fontSize,
          color,
          align,
        });
        continue;
      }

      const fill = readSolidFill(shape);
      if (fill !== "#ffffff") {
        elements.push({
          id: crypto.randomUUID(),
          type: "shape",
          ...box,
          fill,
          radius: 12,
        });
      }
    }

    for (const picture of Array.from(xml.getElementsByTagNameNS(PPT_MAIN_NS, "pic"))) {
      const box = readShapeBox(picture, slideWidth, slideHeight);
      const blip = picture.getElementsByTagNameNS(DRAWING_NS, "blip")[0];
      const embedId = blip?.getAttributeNS(REL_NS, "embed") ?? blip?.getAttribute("r:embed");
      const target = embedId ? rels.get(embedId) : undefined;

      if (!target) {
        deckWarnings.add("Some linked images could not be resolved and may be skipped.");
        continue;
      }

      elements.push({
        id: crypto.randomUUID(),
        type: "image",
        ...box,
        src: await imageDataUrl(zip, target),
        alt: target.split("/").at(-1) ?? "slide image",
      });
    }

    const notes = await parseNotes(zip, rels, relPath);
    slides.push({
      index,
      notes,
      contentModel: {
        kind: "pptx" as const,
        width: slideWidth,
        height: slideHeight,
        background,
        elements,
      },
    });
  }

  return {
    id: crypto.randomUUID(),
    sourceType: "pptx",
    title: file.name.replace(/\.[^.]+$/, ""),
    totalSlides: slides.length,
    slides,
    warnings: Array.from(deckWarnings),
    createdAt: Date.now(),
  };
}
