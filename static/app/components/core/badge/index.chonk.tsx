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
  ${p => ({...makeChonkBadgeTheme(p, p.theme)})};
  border-radius: ${p => p.theme.radius.sm};
  font-size: ${p => p.theme.fontSizeSmall};

  padding: ${p => p.theme.space.micro} ${p => p.theme.space.mini};

  // @TODO(jonasbadalic): this exists on the old badge, but should be removed
  margin-left: ${p => p.theme.space.mini};
`;

function makeChonkBadgeTheme(
  p: ChonkBadgeProps,
  theme: ReturnType<typeof useChonkTheme>
): React.CSSProperties {
  switch (p.type) {
    // @TODO(jonasbadalic) these should use feature badge variants
    case 'alpha':
      return {
        color: theme.colors.static.black,
        background: theme.colors.static.pink400,
      };
    case 'beta':
      return {
        color: theme.colors.static.black,
        background: theme.colors.static.yellow400,
      };
    case 'new':
      return {
        color: theme.colors.static.black,
        background: theme.colors.static.green400,
      };
    case 'experimental':
      return {
        color: theme.colors.dynamic.grayTransparent400,
        background: theme.colors.dynamic.surface300,
      };
    // End feature badge variants
    case 'default':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.grayTransparent400,
      };

    // Highlight maps to info badge for now, but the highlight variant should be removed
    case 'highlight':
    case 'info':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.blue400,
      };
    case 'success':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.green400,
      };
    case 'warning':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.yellow400,
      };
    case 'danger':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.red400,
      };
    case 'promotion':
      return {
        background: theme.colors.dynamic.surface300,
        color: theme.colors.dynamic.pink400,
      };
    default:
      unreachable(p.type);
      throw new TypeError(`Unsupported badge type: ${p.type}`);
  }
}
