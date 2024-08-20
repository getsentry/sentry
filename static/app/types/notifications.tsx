import type {Team} from './organization';

export interface NotificationHistory {
  content: Record<string, any>;
  date_added: string;
  date_updated: string;
  description: string;
  id: string;
  source: string;
  status: string;
  title: string;
  team?: Team;
  user_id?: number;
}
