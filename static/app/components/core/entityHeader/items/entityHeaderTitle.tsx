import {PlatformIcon} from 'platformicons';

import {ProjectAvatar, UserAvatar} from '@sentry/scraps/avatar';
import type {TagProps} from '@sentry/scraps/badge';
import {ROW_HEIGHT, TITLE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import type {AvatarProject} from 'sentry/types/project';
import type {AvatarUser} from 'sentry/types/user';
import {unreachable} from 'sentry/utils/unreachable';

/**
 * The graphic that can sit before the title. Declared as data rather than a
 * node so the header owns the sizing, and so a page cannot quietly put an
 * arbitrary component in the slot.
 */
export type EntityHeaderLeadingGraphic =
  | {type: 'user'; user: AvatarUser}
  | {project: AvatarProject; type: 'project'}
  | {platform: string; type: 'platform'}
  | {icon: React.ComponentType<SVGIconProps>; type: 'icon'};

export interface EntityHeaderTitleProps {
  /**
   * The entity's name. Rendered as the page's `h2` — the `h1` belongs to the
   * TopBar title slot.
   */
  label: string;
  /**
   * Decorative 16x16 graphic. Rendered aria-hidden; the label carries the meaning.
   */
  leadingGraphic?: EntityHeaderLeadingGraphic;
  /**
   * Width of the skeleton shown while the header is loading.
   */
  loadingWidth?: string;
  /**
   * Status chips rendered inline after the label.
   * `null` entries are dropped so callers can inline conditionals.
   */
  tags?: Array<React.ReactElement<TagProps> | null>;
  /**
   * Turns the label into a link.
   */
  to?: LinkProps['to'];
}

function LeadingGraphic({graphic}: {graphic: EntityHeaderLeadingGraphic}) {
  switch (graphic.type) {
    case 'user':
      return <UserAvatar user={graphic.user} size={16} />;
    case 'project':
      return <ProjectAvatar project={graphic.project} size={16} />;
    case 'platform':
      return <PlatformIcon platform={graphic.platform} size="16px" />;
    case 'icon': {
      const Icon = graphic.icon;
      return <Icon size="sm" variant="muted" />;
    }
    default:
      unreachable(graphic);
      return null;
  }
}

export function EntityHeaderTitle({
  isLoading,
  label,
  leadingGraphic,
  loadingWidth = '240px',
  tags,
  to,
}: EntityHeaderTitleProps & {isLoading?: boolean}) {
  if (isLoading) {
    return (
      <Flex align="center" minHeight={ROW_HEIGHT}>
        <Placeholder width={loadingWidth} height={TITLE_HEIGHT} />
      </Flex>
    );
  }

  // Keyed by declaration index, not by position in the filtered array, so a
  // conditional tag appearing never remounts the ones after it.
  const visibleTags = (tags ?? [])
    .map((tag, index) => ({tag, index}))
    .filter(
      (entry): entry is {index: number; tag: React.ReactElement<TagProps>} =>
        entry.tag !== null
    );

  return (
    <Flex align="center" gap="sm" minWidth={0} minHeight={ROW_HEIGHT}>
      {leadingGraphic && (
        <Flex
          align="center"
          justify="center"
          width="16px"
          height="16px"
          flexShrink={0}
          aria-hidden
        >
          <LeadingGraphic graphic={leadingGraphic} />
        </Flex>
      )}
      <Heading as="h2" size="lg" density="comfortable" ellipsis>
        {to ? <Link to={to}>{label}</Link> : label}
      </Heading>
      {visibleTags.length > 0 && (
        <Flex align="center" gap="xs" flexShrink={0}>
          {visibleTags.map(({tag, index}) => (
            <Flex key={index}>{tag}</Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
