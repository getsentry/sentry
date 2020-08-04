export type DashboardData = {
  cards: CardData[];
};

export type CardData = {
  id?: string;
  columnSpan: 1 | 2 | 3; // Size of the card
  content: React.ReactNode;
};
