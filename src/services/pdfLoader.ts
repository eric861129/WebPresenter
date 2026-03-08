import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { DeckDocument } from "../types";

GlobalWorkerOptions.workerSrc = workerUrl;

const pdfCache = new Map<string, Promise<PDFDocumentProxy>>();

export async function parsePdfFile(file: File): Promise<DeckDocument> {
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const slides = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    slides.push({
      index: pageNumber - 1,
      contentModel: {
        kind: "pdf" as const,
        width: viewport.width,
        height: viewport.height,
        pageNumber,
      },
    });
  }

  return {
    id: crypto.randomUUID(),
    sourceType: "pdf",
    title: file.name.replace(/\.[^.]+$/, ""),
    totalSlides: slides.length,
    slides,
    warnings: [],
    createdAt: Date.now(),
  };
}

export function loadPdfDocument(deckId: string, file: Blob) {
  if (!pdfCache.has(deckId)) {
    pdfCache.set(
      deckId,
      file
        .arrayBuffer()
        .then((data) => getDocument({ data }).promise),
    );
  }

  return pdfCache.get(deckId)!;
}
