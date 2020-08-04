export type DashboardData = {
  cards: CardData[];
};

export type CardData = {
  // For drawing the UI
  key?: string;
  columnSpan: 1 | 2 | 3; // Size of the card

  // Data that'll fill a database row
  data: {
    id?: string;
    [key: string]: any;
  };
};
