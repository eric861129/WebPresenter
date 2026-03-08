import JSZip from "jszip";

import type { DeckDocument, SlideElement } from "../types";

const PPT_MAIN_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

type RelationshipMap = Map<string, string>;
type ThemeColorMap = Map<string, string>;
type ThemeContext = {
  schemeColors: ThemeColorMap;
  colorMap: ThemeColorMap;
};

function parseXml(xmlText: string) {
  return new DOMParser().parseFromString(xmlText, "application/xml");
}

function normalizeHexColor(value: string | null | undefined, fallback = "#111111") {
  if (!value) {
    return fallback;
  }

  return value.startsWith("#") ? value : `#${value}`;
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

function resolveSchemeColor(name: string, theme: ThemeContext) {
  const mappedName = theme.colorMap.get(name) ?? name;
  return theme.schemeColors.get(mappedName) ?? "#111111";
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

function readSolidFill(element: Element, theme?: ThemeContext, fallback = "#ffffff") {
  const solidFill = childElements(element, "solidFill", true)[0];
  if (!solidFill) {
    return fallback;
  }

  const rgb = childElements(solidFill, "srgbClr")[0];
  if (rgb?.getAttribute("val")) {
    return normalizeHexColor(rgb.getAttribute("val"), fallback);
  }

  const sysClr = childElements(solidFill, "sysClr")[0];
  if (sysClr?.getAttribute("lastClr")) {
    return normalizeHexColor(sysClr.getAttribute("lastClr"), fallback);
  }

  const schemeClr = childElements(solidFill, "schemeClr")[0];
  if (schemeClr && theme) {
    return resolveSchemeColor(schemeClr.getAttribute("val") ?? "", theme);
  }

  return fallback;
}

async function parseTheme(zip: JSZip): Promise<ThemeContext> {
  const themeFile = zip.file("ppt/theme/theme1.xml");
  const schemeColors: ThemeColorMap = new Map();
  const colorMap: ThemeColorMap = new Map([
    ["bg1", "lt1"],
    ["tx1", "dk1"],
    ["bg2", "lt2"],
    ["tx2", "dk2"],
  ]);

  if (themeFile) {
    const xml = parseXml(await themeFile.async("text"));
    const clrScheme = xml.getElementsByTagNameNS(DRAWING_NS, "clrScheme")[0];

    if (clrScheme) {
      Array.from(clrScheme.children).forEach((entry) => {
        if (!(entry instanceof Element)) {
          return;
        }

        const srgb = childElements(entry, "srgbClr", true)[0];
        const sys = childElements(entry, "sysClr", true)[0];
        const color =
          srgb?.getAttribute("val") ??
          sys?.getAttribute("lastClr") ??
          null;

        if (color) {
          schemeColors.set(entry.localName, normalizeHexColor(color));
        }
      });
    }
  }

  const slideMasterFile = Object.keys(zip.files)
    .filter((path) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path))
    .sort()[0];

  if (slideMasterFile) {
    const xml = parseXml(await zip.file(slideMasterFile)!.async("text"));
    const clrMap = xml.getElementsByTagNameNS(PPT_MAIN_NS, "clrMap")[0];

    if (clrMap) {
      ["bg1", "tx1", "bg2", "tx2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6"].forEach(
        (key) => {
          const value = clrMap.getAttribute(key);
          if (value) {
            colorMap.set(key, value);
          }
        },
      );
    }
  }

  return {
    schemeColors,
    colorMap,
  };
}

function readTextColor(shape: Element, theme: ThemeContext) {
  const candidateNodes = [
    ...Array.from(shape.getElementsByTagNameNS(DRAWING_NS, "rPr")),
    ...Array.from(shape.getElementsByTagNameNS(DRAWING_NS, "defRPr")),
    ...Array.from(shape.getElementsByTagNameNS(DRAWING_NS, "endParaRPr")),
  ];

  for (const node of candidateNodes) {
    const color = readSolidFill(node, theme, "");
    if (color) {
      return color;
    }
  }

  return resolveSchemeColor("tx1", theme);
}

function mapParagraphAlign(value: string | null | undefined): "left" | "center" | "right" {
  if (value === "ctr" || value === "center") {
    return "center";
  }

  if (value === "r" || value === "right") {
    return "right";
  }

  return "left";
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
  const theme = await parseTheme(zip);
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
    const background = readSolidFill(xml.documentElement, theme, "#ffffff");
    const elements: SlideElement[] = [];
    const shapeTree = xml.getElementsByTagNameNS(PPT_MAIN_NS, "spTree")[0];
    const orderedNodes = shapeTree ? Array.from(shapeTree.children) : [];

    for (const node of orderedNodes) {
      if (!(node instanceof Element)) {
        continue;
      }

      if (node.localName === "sp") {
        const box = readShapeBox(node, slideWidth, slideHeight);
        const paragraphs = readTextNodes(node);
        const fontNode =
          node.getElementsByTagNameNS(DRAWING_NS, "defRPr")[0] ??
          node.getElementsByTagNameNS(DRAWING_NS, "rPr")[0] ??
          node.getElementsByTagNameNS(DRAWING_NS, "endParaRPr")[0];
        const fontSize = Number(fontNode?.getAttribute("sz") ?? 2200) / 100;
        const color = readTextColor(node, theme);
        const alignNode = node.getElementsByTagNameNS(DRAWING_NS, "pPr")[0];
        const align = mapParagraphAlign(alignNode?.getAttribute("algn"));

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

        const fill = readSolidFill(node, theme, "");
        if (fill) {
          elements.push({
            id: crypto.randomUUID(),
            type: "shape",
            ...box,
            fill,
            radius: 12,
          });
        }
      }

      if (node.localName === "pic") {
        const box = readShapeBox(node, slideWidth, slideHeight);
        const blip = node.getElementsByTagNameNS(DRAWING_NS, "blip")[0];
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
