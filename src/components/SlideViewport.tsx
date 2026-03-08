import { useEffect, useRef, useState } from "react";

import { loadPdfDocument } from "../services/pdfLoader";
import type { DeckDocument, SlideRecord } from "../types";

type Props = {
  deck: DeckDocument;
  file?: Blob;
  slide: SlideRecord;
  className?: string;
};

export function SlideViewport({ deck, file, slide, className }: Props) {
  if (slide.contentModel.kind === "pptx") {
    const { width, height, background, elements } = slide.contentModel;

    return (
      <div
        className={className ? `slide-frame ${className}` : "slide-frame"}
        style={{
          aspectRatio: `${width}/${height}`,
          background,
        }}
      >
        {elements.map((element) => {
          if (element.type === "text") {
            return (
              <div
                key={element.id}
                className="ppt-text"
                style={{
                  left: `${element.x * 100}%`,
                  top: `${element.y * 100}%`,
                  width: `${element.width * 100}%`,
                  height: `${element.height * 100}%`,
                  color: element.color,
                  fontSize: `${Math.max(14, element.fontSize / 2)}px`,
                  textAlign: element.align ?? "left",
                }}
              >
                {element.paragraphs.map((paragraph, index) => (
                  <p key={`${element.id}-${index}`}>{paragraph}</p>
                ))}
              </div>
            );
          }

          if (element.type === "shape") {
            return (
              <div
                key={element.id}
                className="ppt-shape"
                style={{
                  left: `${element.x * 100}%`,
                  top: `${element.y * 100}%`,
                  width: `${element.width * 100}%`,
                  height: `${element.height * 100}%`,
                  background: element.fill,
                  borderRadius: `${element.radius ?? 0}px`,
                }}
              />
            );
          }

          return (
            <img
              key={element.id}
              alt={element.alt}
              className="ppt-image"
              src={element.src}
              style={{
                left: `${element.x * 100}%`,
                top: `${element.y * 100}%`,
                width: `${element.width * 100}%`,
                height: `${element.height * 100}%`,
              }}
            />
          );
        })}
      </div>
    );
  }

  return <PdfSlideView className={className} deck={deck} file={file} slide={slide} />;
}

function PdfSlideView({ deck, file, slide, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function render() {
      if (!file || !canvasRef.current || slide.contentModel.kind !== "pdf") {
        return;
      }

      try {
        setError(null);
        const pdf = await loadPdfDocument(deck.id, file);
        const page = await pdf.getPage(slide.contentModel.pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context || !active) {
          return;
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas: canvasRef.current, canvasContext: context, viewport }).promise;
      } catch (renderError) {
        if (active) {
          setError(renderError instanceof Error ? renderError.message : "PDF render failed");
        }
      }
    }

    render();

    return () => {
      active = false;
    };
  }, [deck.id, file, slide]);

  return (
    <div className={className ? `slide-frame ${className}` : "slide-frame"}>
      {error ? <p className="status-card warning">{error}</p> : null}
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  );
}
