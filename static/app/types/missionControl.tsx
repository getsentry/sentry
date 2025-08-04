/**
 * Base interface for all Mission Control cards.
 * This defines the core contract that all card types must implement.
 */
export interface MissionControlCard {
  /**
   * Timestamp when this card was created
   */
  createdAt: string;

  /**
   * Card-specific data payload
   */
  data: Record<string, unknown>;

  /**
   * Unique identifier for this card instance
   */
  id: string;

  /**
   * The type of card - must match a known card type
   */
  type: string;

  /**
   * Optional metadata for analytics, debugging, etc.
   */
  metadata?: {
    [key: string]: unknown;
    source?: string;
    tags?: string[];
  };

  // ISO string from API
  /**
   * Optional priority for ordering cards (higher = more important)
   * Cards with higher priority appear first in the queue
   */
  priority?: number;
}

/**
 * Configuration for the primary action button on a card
 */
export interface CardPrimaryAction {
  /**
   * Function to execute when the action is triggered
   * Should return a Promise that resolves when the action is complete
   * The card will be automatically dismissed after successful completion
   */
  handler: (card: MissionControlCard) => Promise<void>;

  /**
   * Text to display on the action button
   */
  label: string;

  /**
   * Whether the action is destructive (affects button styling)
   */
  destructive?: boolean;

  /**
   * Whether the action is disabled
   */
  disabled?: boolean;

  /**
   * Optional loading text to show while action is in progress
   */
  loadingLabel?: string;
}

/**
 * Props passed to card renderer components
 */
export interface CardRendererProps<TData = Record<string, unknown>> {
  /**
   * The card being rendered
   */
  card: MissionControlCard & {data: TData};

  /**
   * Function to register/update the primary action for this card
   * Pass null to remove the primary action
   */
  onSetPrimaryAction: (action: CardPrimaryAction | null) => void;
}

/**
 * Mission Control queue state
 */
export interface MissionControlQueueState {
  /**
   * All cards in the queue (ordered by priority, then creation time)
   */
  cards: MissionControlCard[];

  /**
   * Index of the currently active card (null if queue is empty)
   */
  currentIndex: number | null;

  /**
   * Current primary action for the active card (if any)
   */
  currentPrimaryAction: CardPrimaryAction | null;

  /**
   * Whether an action is currently in progress
   */
  isActionLoading: boolean;
}

/**
 * Actions for managing the Mission Control queue
 */
export interface MissionControlQueueActions {
  /**
   * Add a new card to the queue
   */
  addCard: (card: MissionControlCard) => void;

  /**
   * Clear all cards from the queue
   */
  clearQueue: () => void;

  /**
   * Dismiss the current card and move to the next one
   */
  dismissCurrentCard: () => void;

  /**
   * Execute the current primary action
   */
  executePrimaryAction: () => Promise<void>;

  /**
   * Move to a specific card by index
   */
  goToCard: (index: number) => void;

  /**
   * Refresh cards from the API
   */
  refreshCards: () => Promise<void>;

  /**
   * Remove a card from the queue by ID
   */
  removeCard: (cardId: string) => void;

  /**
   * Set/update the primary action for the current card
   */
  setPrimaryAction: (action: CardPrimaryAction | null) => void;
}

/**
 * Card renderer component type
 * Future devs will implement components of this type for new card types
 */
export type CardRenderer<TData = Record<string, unknown>> = React.ComponentType<
  CardRendererProps<TData>
>;

/**
 * Generic card renderer type that can accept any data shape
 */
export type AnyCardRenderer = React.ComponentType<CardRendererProps<any>>;

/**
 * Helper type for creating typed card data interfaces
 * Example usage:
 *
 * interface WelcomeCardData {
 *   userName: string;
 *   isFirstTime: boolean;
 * }
 *
 * type WelcomeCard = TypedMissionControlCard<'welcome', WelcomeCardData>;
 */
export type TypedMissionControlCard<
  TType extends string,
  TData = Record<string, unknown>,
> = Omit<MissionControlCard, 'type' | 'data'> & {
  data: TData;
  type: TType;
};

/**
 * Union type of all known card types - future devs should extend this
 */
export type KnownCardTypes =
  | 'welcome'
  | 'changelog'
  | 'issue'
  | 'missing-instrumentation'
  | 'ultragroup';
