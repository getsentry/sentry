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
    // @TODO(jonasbadalic) these should use feature badge variants
    case 'alpha':
      return {
        color: theme.colors.static.black,
        // @TODO(jonasbadalic) should this use theme colors?
        background: `linear-gradient(103deg, #EE8019 0%, #FAA80A 25%, #FBB20B 50%, #FAA80A 75%, #EE8019 100%);`,
      };
    case 'beta':
      return {
        color: theme.colors.static.white,
        // @TODO(jonasbadalic) should this use theme colors?
        background: `linear-gradient(103deg, #FC8B61 0%, #FC5F64 50%, #F32474 100%);`,
      };
    case 'new':
      return {
        color: theme.colors.static.white,
        // @TODO(jonasbadalic) should this use theme colors?
        background: `linear-gradient(103deg, #7B51F8 0%, #F644AB 100%);`,
      };
    case 'experimental':
      return {
        color: theme.colors.static.white,
        // @TODO(jonasbadalic) should this use theme colors?
        background: `linear-gradient(103deg, #4E2A9A 0%, #7C30A9 25%, #A737B4 50%, #F2306F 75%, #EE8019 100%);`,
      };
    // End feature badge variants
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
