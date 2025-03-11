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
        color: theme.colors.black,
        background: theme.colors.chonk.pink400,
      };
    case 'beta':
      return {
        color: theme.colors.black,
        background: theme.colors.chonk.yellow400,
      };
    case 'new':
      return {
        color: theme.colors.black,
        background: theme.colors.chonk.green400,
      };
    case 'experimental':
      return {
        color: theme.colors.gray500,
        background: theme.colors.gray100,
      };
    // End feature badge variants
    case 'default':
      return {
        color: theme.colors.gray500,
        background: theme.colors.gray100,
      };

    // Highlight maps to info badge for now, but the highlight variant should be removed
    case 'highlight':
    case 'info':
      return {
        color: theme.colors.blue500,
        background: theme.colors.blue100,
      };
    case 'promotion':
      return {
        color: theme.colors.pink500,
        background: theme.colors.pink100,
      };
    case 'danger':
      return {
        color: theme.colors.red500,
        background: theme.colors.red100,
      };
    case 'warning':
      return {
        color: theme.colors.yellow500,
        background: theme.colors.yellow100,
      };
    case 'success':
      return {
        color: theme.colors.green500,
        background: theme.colors.green100,
      };
    default:
      unreachable(p.type);
      throw new TypeError(`Unsupported badge type: ${p.type}`);
  }
}
