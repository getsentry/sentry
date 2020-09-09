/**
 * Represents a mentionable user or team.
 */
export type Mentionable = {
  id: string;
  display: string;
  email: string;
};

/**
 * List of id, display name
 */
export type Mentioned = [string, string];

/**
 * The typings for the react-mentionables library use this type
 * for their change event so we also use it.
 */
export type MentionChangeEvent = {target: {value: string}};

export type CreateError = {
  detail: {
    message: string;
    code: number;
    extra: any;
  };
};
