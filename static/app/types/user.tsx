import {Avatar} from './core';

/**
 * Avatars are a more primitive version of User.
 */
export type AvatarUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  ip_address: string;
  avatarUrl?: string;
  avatar?: Avatar;
  // Compatibility shim with EventUser serializer
  ipAddress?: string;
  options?: {
    avatarType: Avatar['avatarType'];
  };
  lastSeen?: string;
};
