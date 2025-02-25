import type {BadgeProps} from 'sentry/components/core/badge';
import {chonkStyled, type useChonkTheme} from 'sentry/utils/theme/theme.chonk';
import type {ChonkPropMapping} from 'sentry/utils/theme/withChonk';
import {unreachable} from 'sentry/utils/unreachable';

type FeatureBadgeType = 'alpha' | 'beta' | 'new' | 'experimental';
interface ChonkBadgeProps extends Omit<BadgeProps, 'type'> {
  type:
    | 'default'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'highlight'
    | 'promotion'
    | FeatureBadgeType;
}

export const chonkBadgePropMapping: ChonkPropMapping<
  BadgeProps,
  ChonkBadgeProps
> = props => {
  return {
    ...props,
    type: props.type === 'internal' ? 'default' : props.type,
  };
};

export function ChonkBadge(props: ChonkBadgeProps) {
  return <StyledChonkBadge {...props} />;
}

const StyledChonkBadge = chonkStyled('span')<ChonkBadgeProps>`
  ${p => ({...makeBadgeTheme(p, p.theme)})};
  border-radius: ${p => p.theme.radius.sm};
  font-size: ${p => p.theme.fontSizeSmall};

  padding: ${p => p.theme.space.micro} ${p => p.theme.space.mini};

  // @TODO(jonasbadalic): this exists on the old badge, but should be removed
  margin-left: ${p => p.theme.space.mini};
`;

function makeBadgeTheme(
  p: ChonkBadgeProps,
  theme: ReturnType<typeof useChonkTheme>
): React.CSSProperties {
  switch (p.type) {
    // @TODO(jonasbadalic) these should use feature badge
    case 'alpha':
    case 'beta':
    case 'new':
    case 'experimental':
    case 'default':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.grayTransparent400,
      };
    case 'info':
      return {
        background: theme.colors.static.blue400,
        color: theme.colors.static.white,
      };
    case 'success':
      return {
        background: theme.colors.static.green400,
        color: theme.colors.static.black,
      };
    case 'warning':
      return {
        background: theme.colors.static.yellow400,
        color: theme.colors.static.black,
      };
    case 'danger':
      return {
        background: theme.colors.static.red400,
        color: theme.colors.static.white,
      };
    case 'promotion':
      return {
        background: theme.colors.static.pink400,
        color: theme.colors.static.black,
      };
    case 'highlight':
      return {
        background: theme.colors.dynamic.blue400,
        color: theme.colors.static.white,
      };
    default:
      unreachable(p.type);
      throw new TypeError(`Unsupported badge type: ${p.type}`);
  }
}
