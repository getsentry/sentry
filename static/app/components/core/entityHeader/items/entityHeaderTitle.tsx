import {UserAvatar} from '@sentry/scraps/avatar';
import type {TagProps} from '@sentry/scraps/badge';
import {ProjectsBadge} from '@sentry/scraps/badge';
import {ROW_HEIGHT, TITLE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import type {AvatarProject} from 'sentry/types/project';
import type {AvatarUser} from 'sentry/types/user';
import {defined} from 'sentry/utils/defined';
import {unreachable} from 'sentry/utils/unreachable';

/**
 * Edge of the box the leading graphic occupies, whatever it holds.
 */
const LEADING_GRAPHIC_SIZE = 24;

/**
 * A user avatar is drawn smaller than that box and centred in it.
 *
 * The avatars in the people slot are 24 with a 2px border, and `box-sizing` is
 * border-box, so their visible disc is 20. A borderless 24 here would be the
 * larger of the two circles in the same header.
 */
const LEADING_AVATAR_SIZE = 20;

interface EntityHeaderLeadingGraphicBase {
  /**
   * Names the graphic for assistive technology, and shows on hover.
   *
   * Leave it off when the graphic repeats what the title already says — a
   * platform icon next to "ValueError" tells a screen reader nothing new, and
   * stays decorative. Give it one when the graphic carries something the title
   * does not, such as which projects a trace touched.
   */
  label?: string;
  /**
   * Richer hover content than `label`, for a graphic standing in for a list.
   * Requires `label`, which remains the accessible name.
   */
  tooltip?: React.ReactNode;
}

/**
 * The graphic that can sit before the title. Declared as data rather than a
 * node so the header owns the sizing, and so a page cannot quietly put an
 * arbitrary component in the slot.
 *
 * `project` and `platform` render the same badge but take what the caller
 * actually holds: a trace knows its projects, a build has only inferred a
 * platform from a file type. Mapping projects to platforms happens here rather
 * than at every call site.
 */
export type EntityHeaderLeadingGraphic =
  | ({type: 'user'; user: AvatarUser} & EntityHeaderLeadingGraphicBase)
  | ({projects: AvatarProject[]; type: 'project'} & EntityHeaderLeadingGraphicBase)
  | ({platform: string; type: 'platform'} & EntityHeaderLeadingGraphicBase);

export interface EntityHeaderTitleProps {
  /**
   * The entity's name. Rendered as the page's `h2` — the `h1` belongs to the
   * TopBar title slot.
   */
  label: string;
  /**
   * A 24px graphic before the title. Decorative unless it is given a label.
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
      return <UserAvatar user={graphic.user} size={LEADING_AVATAR_SIZE} />;
    case 'project': {
      const platforms = graphic.projects.map(project => project.platform).filter(defined);
      // `ProjectsBadge` falls back to an all-projects glyph for an empty list,
      // which belongs to a saved view, not to the entity a page is about.
      return platforms.length === 0 ? null : (
        <ProjectsBadge projectPlatforms={platforms} size={LEADING_GRAPHIC_SIZE} />
      );
    }
    case 'platform':
      return (
        <ProjectsBadge
          projectPlatforms={[graphic.platform]}
          size={LEADING_GRAPHIC_SIZE}
        />
      );
    default:
      unreachable(graphic);
      return null;
  }
}

function LeadingGraphicSlot({graphic}: {graphic: EntityHeaderLeadingGraphic}) {
  const slot = (
    <Flex
      align="center"
      justify="center"
      width={`${LEADING_GRAPHIC_SIZE}px`}
      height={`${LEADING_GRAPHIC_SIZE}px`}
      flexShrink={0}
      // Labelled, the slot becomes an image in its own right and the badge
      // inside it stays decorative, which is what lets a trace say which
      // projects it touched. Unlabelled, the whole thing is hidden.
      {...(graphic.label
        ? {role: 'img', 'aria-label': graphic.label, tabIndex: 0}
        : {'aria-hidden': true})}
    >
      <LeadingGraphic graphic={graphic} />
    </Flex>
  );

  return graphic.label ? (
    <Tooltip title={graphic.tooltip ?? graphic.label} skipWrapper>
      {slot}
    </Tooltip>
  ) : (
    slot
  );
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
      {leadingGraphic && <LeadingGraphicSlot graphic={leadingGraphic} />}
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
