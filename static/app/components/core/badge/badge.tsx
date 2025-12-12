import * as ChonkBadge from './badge.chonk';

type BadgeType =
  | 'alpha'
  | 'beta'
  | 'new'
  | 'warning'
  // @TODO(jonasbadalic) "default" is bad API decision.
  // @TODO(jonasbadalic) default, experimental and internal all look the same...
  | 'experimental'
  | 'internal'
  | 'default';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  type: BadgeType | 'internal';
}

export function Badge({children, type, ...props}: BadgeProps) {
  return (
    <BadgeComponent {...props} type={type === 'internal' ? 'default' : type}>
      {children}
    </BadgeComponent>
  );
}

const BadgeComponent = ChonkBadge.ChonkBadge;
