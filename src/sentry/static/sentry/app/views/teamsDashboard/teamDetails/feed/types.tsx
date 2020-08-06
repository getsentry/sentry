export type FeedData = {
  cards: CardData[];
  sections: Section[];
};

export type Section = {
  kind: string;
  name: string;
};

export type CardData = {
  // For drawing the UI
  key?: string;
  type?: string;
  columnSpan: 1 | 2 | 3; // Size of the card

  // Data that'll fill a database row
  data: {
    id?: string;
    [key: string]: any;
  };
};
