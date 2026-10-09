import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import type {PlatformIcon} from 'platformicons';

import type {UserAvatar} from '@sentry/scraps/avatar';
import {METADATA_TEXT_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';

const TEXT_STYLES = {
  size: 'md',
  density: 'comfortable',
  wrap: 'nowrap',
} as const;

interface EntityHeaderMetadataItemBase {
  label: string;
  leadingGraphic?:
    | React.ReactElement<SVGIconProps>
    | React.ReactElement<React.ComponentProps<typeof PlatformIcon>>
    | React.ReactElement<React.ComponentProps<typeof UserAvatar>>;
  /**
   * @default 'compact'
   */
  mode?: 'compact' | 'full';
  secondary?: {
    label: string;
    value: React.ReactNode;
  };
  tooltip?: React.ReactNode;
}

export type EntityHeaderMetadataItemProps = EntityHeaderMetadataItemBase &
  (
    | {
        type: 'text';
        value: React.ReactNode;
        variant?: 'primary' | 'muted' | 'danger' | 'success' | 'warning';
      }
    | {
        to: LinkProps['to'];
        type: 'link';
        value: string;
      }
  );

export function EntityHeaderMetadataItemSkeleton() {
  return (
    <Flex role="listitem" align="center" minWidth={0} minHeight={METADATA_TEXT_HEIGHT}>
      <Placeholder width="120px" height={METADATA_TEXT_HEIGHT} />
    </Flex>
  );
}

function MetadataValue(props: EntityHeaderMetadataItemProps) {
  const {label, tooltip} = props;

  if (props.type === 'link') {
    return (
      <Text {...TEXT_STYLES} variant="accent">
        {styleProps => {
          const link = (
            <Link to={props.to} aria-label={`${label} ${props.value}`} {...styleProps}>
              {props.value}
            </Link>
          );
          return tooltip ? (
            <Tooltip title={tooltip} skipWrapper showUnderline>
              {link}
            </Tooltip>
          ) : (
            link
          );
        }}
      </Text>
    );
  }

  return tooltip ? (
    <InfoText title={tooltip} variant={props.variant} {...TEXT_STYLES}>
      {props.value}
    </InfoText>
  ) : (
    <Text variant={props.variant} {...TEXT_STYLES}>
      {props.value}
    </Text>
  );
}

export function EntityHeaderMetadataItem(
  props: EntityHeaderMetadataItemProps & {isLoading?: boolean}
) {
  const {isLoading, label, leadingGraphic, mode = 'compact', secondary} = props;
  const needsOwnLabel = props.type === 'text' || mode === 'full';

  return (
    <Flex
      role="listitem"
      align="center"
      gap="xs"
      minWidth={0}
      minHeight={METADATA_TEXT_HEIGHT}
    >
      {leadingGraphic && (
        <Flex
          width="16px"
          height="16px"
          align="center"
          justify="center"
          flexShrink={0}
          aria-hidden
        >
          {isLoading ? null : leadingGraphic}
        </Flex>
      )}
      {isLoading ? (
        <Placeholder width="120px" height={METADATA_TEXT_HEIGHT} />
      ) : (
        <Fragment>
          {needsOwnLabel &&
            (mode === 'full' ? (
              <Text {...TEXT_STYLES} variant="muted">
                {label}
              </Text>
            ) : (
              <VisuallyHidden>{label}</VisuallyHidden>
            ))}
          <MetadataValue {...props} />
          {secondary && (
            <Fragment>
              {/*
                The composed key is real text and not only the tooltip's,
                because a tooltip reaches assistive technology through
                `aria-describedby`, which is not announced on focus.
              */}
              <VisuallyHidden>{`${label} ${secondary.label}`}</VisuallyHidden>
              <InfoText
                title={`${label} ${secondary.label}`}
                variant="muted"
                {...TEXT_STYLES}
              >
                {secondary.value}
              </InfoText>
            </Fragment>
          )}
        </Fragment>
      )}
    </Flex>
  );
}
