import { parsePdfFile } from "./pdfLoader";
import { parsePptxFile } from "./pptxLoader";

export async function importDeckFromFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "pdf") {
    return parsePdfFile(file);
  }

  if (extension === "pptx") {
    return parsePptxFile(file);
  }

  throw new Error("Only PDF and PPTX files are supported in v1.");
}
