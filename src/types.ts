export type DeckSourceType = "pdf" | "pptx";

export type SlideElement =
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize: number;
      color: string;
      paragraphs: string[];
      align?: "left" | "center" | "right";
    }
  | {
      id: string;
      type: "image";
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
      alt: string;
    }
  | {
      id: string;
      type: "shape";
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
      radius?: number;
    };

export type SlideContentModel =
  | {
      kind: "pdf";
      width: number;
      height: number;
      pageNumber: number;
    }
  | {
      kind: "pptx";
      width: number;
      height: number;
      background: string;
      elements: SlideElement[];
    };

export type SlideRecord = {
  index: number;
  preview?: string;
  notes?: string;
  contentModel: SlideContentModel;
};

export type DeckDocument = {
  id: string;
  sourceType: DeckSourceType;
  title: string;
  totalSlides: number;
  slides: SlideRecord[];
  warnings: string[];
  createdAt: number;
};

export type PresentationMode = "single" | "dual";

export type PresentationSession = {
  sessionId: string;
  deckId: string;
  currentSlide: number;
  blackout: boolean;
  mode: PresentationMode;
  connectedRemote: string[];
  startedAt: number;
};

export type RemoteCommand =
  | {
      type: "NEXT" | "PREV" | "TOGGLE_BLACKOUT" | "SYNC_REQUEST";
    }
  | {
      type: "GOTO";
      index: number;
    }
  | {
      type: "SYNC_STATE";
      session: PresentationSession;
      notes?: string;
      totalSlides: number;
      title: string;
    };

export type SyncMessage =
  | {
      type: "SESSION_UPDATE";
      session: PresentationSession;
    }
  | {
      type: "DECK_ACTIVATED";
      deckId: string;
    };

export type DeckRecordSummary = Pick<
  DeckDocument,
  "id" | "title" | "sourceType" | "totalSlides" | "warnings" | "createdAt"
>;
