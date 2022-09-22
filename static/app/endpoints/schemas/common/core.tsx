import {z} from 'zod';

export const avatarTypeSchema = z.enum([
  'letter_avatar',
  'upload',
  'gravatar',
  'background',
  'default',
]);

export const avatarSchema = z.object({
  avatarType: avatarTypeSchema,
  avatarUuid: z.string().nullable(),
  color: z.boolean().optional(),
});

export type AvatarTypeSchema = z.infer<typeof avatarTypeSchema>;
