export type PermissionValue = 'no-access' | 'read' | 'write' | 'admin' | 'delete';

export type Permissions = {
  Event: PermissionValue;
  Member: PermissionValue;
  Organization: PermissionValue;
  Project: PermissionValue;
  Release: PermissionValue;
  Team: PermissionValue;
  Alerts?: PermissionValue;
  Dashboard?: PermissionValue;
  Distribution?: PermissionValue;
};

export type PermissionResource = keyof Permissions;
