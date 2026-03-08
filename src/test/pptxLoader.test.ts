import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { parsePptxFile } from "../services/pptxLoader";

async function buildSamplePptx() {
  const zip = new JSZip();
  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:sldSz cx="9144000" cy="5143500" />
      </p:presentation>`,
  );
  zip.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:spPr>
                <a:xfrm>
                  <a:off x="914400" y="514350" />
                  <a:ext cx="3657600" cy="1028700" />
                </a:xfrm>
              </p:spPr>
              <p:txBody>
                <a:p>
                  <a:r><a:rPr sz="2400" /><a:t>Hello slide</a:t></a:r>
                </a:p>
              </p:txBody>
            </p:sp>
            <p:graphicFrame />
          </p:spTree>
        </p:cSld>
      </p:sld>`,
  );
  zip.file(
    "ppt/slides/_rels/slide1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Target="../notesSlides/notesSlide1.xml" />
      </Relationships>`,
  );
  zip.file(
    "ppt/notesSlides/notesSlide1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
        xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p><a:r><a:t>Remember this point</a:t></a:r></a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:notes>`,
  );

  return new File([await zip.generateAsync({ type: "blob" })], "sample.pptx");
}

describe("parsePptxFile", () => {
  it("extracts slide text, notes, and warnings", async () => {
    const file = await buildSamplePptx();
    const deck = await parsePptxFile(file);

    expect(deck.totalSlides).toBe(1);
    expect(deck.slides[0].notes).toContain("Remember this point");
    expect(deck.slides[0].contentModel.kind).toBe("pptx");
    expect(deck.warnings[0]).toContain("Charts");
  });
});
