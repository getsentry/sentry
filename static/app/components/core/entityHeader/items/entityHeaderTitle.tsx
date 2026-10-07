import {VisuallyHidden} from '@react-aria/visually-hidden';

import {UserAvatar} from '@sentry/scraps/avatar';
import type {TagProps} from '@sentry/scraps/badge';
import {ProjectsBadge} from '@sentry/scraps/badge';
import {ROW_HEIGHT, TITLE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import type {AvatarProject} from 'sentry/types/project';
import type {AvatarUser} from 'sentry/types/user';
import {defined} from 'sentry/utils/defined';
import {unreachable} from 'sentry/utils/unreachable';

const LEADING_GRAPHIC_SIZE = 24;
const LEADING_AVATAR_SIZE = 20;

/**
 * Either the graphic is named, in which case it may also elaborate on hover, or
 * it is decorative and says nothing.
 */
type EntityHeaderLeadingGraphicBase =
  | {
      /**
       * Names the graphic for assistive technology. Give it one when the
       * graphic carries something the title does not, such as which projects a
       * trace touched.
       */
      label: string;
      /**
       * Richer hover content than `label`. Mouse-only — the graphic is not
       * focusable — so keep anything a user needs in `label` itself.
       */
      tooltip?: React.ReactNode;
    }
  | {
      /**
       * Leave both off when the graphic repeats what the title already says. A
       * platform icon next to "ValueError" tells a screen reader nothing new.
       */
      label?: never;
      tooltip?: never;
    };

/**
 * The graphic that can sit before the title.
 *
 * `project` and `platform` render the same badge but take what the caller
 * actually holds: a trace knows its projects, a build has only inferred a
 * platform from a file type.
 */
export type EntityHeaderLeadingGraphic =
  | ({type: 'user'; user: AvatarUser} & EntityHeaderLeadingGraphicBase)
  | ({projects: AvatarProject[]; type: 'project'} & EntityHeaderLeadingGraphicBase)
  | ({platform: string; type: 'platform'} & EntityHeaderLeadingGraphicBase);

export interface EntityHeaderTitleProps {
  /**
   * What the value is — "Replay user", "Issue type". Required, and read before
   * the value by assistive technology.
   *
   * It is not rendered. A sighted reader gets this from the graphic beside the
   * title and the breadcrumb above it; someone jumping straight to the heading
   * gets an unexplained string without it. Same meaning as a stat's `label`,
   * which is why it has the same name.
   */
  label: string;
  /**
   * The entity's name. Rendered as the page's `h2` — the `h1` belongs to the
   * TopBar title slot.
   */
  value: string;
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
}

function LeadingGraphic({graphic}: {graphic: EntityHeaderLeadingGraphic}) {
  switch (graphic.type) {
    case 'user':
      return <UserAvatar user={graphic.user} size={LEADING_AVATAR_SIZE} />;
    case 'project': {
      const platforms = graphic.projects.map(project => project.platform).filter(defined);
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
      // `role="img"` with a name is announced without focus, so there is
      // nothing here to tab to — a stop a keyboard user cannot activate,
      // dismiss, or read anything further from.
      {...(graphic.label
        ? {role: 'img', 'aria-label': graphic.label}
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
  value,
}: EntityHeaderTitleProps & {isLoading?: boolean}) {
  // Named from both, so heading navigation lands on "Replay user,
  // anonymous@example.com" rather than on an email address with no frame. The
  // comma is what gives a screen reader its pause; visually hidden text inside
  // the heading would read as one run.
  const accessibleName = `${label}, ${value}`;
  if (isLoading) {
    // The heading stays in the tree, carrying the label the caller already has.
    // Dropping it would make the page's structure change as the data lands, so
    // anyone navigating by heading mid-load would find nothing and no signal to
    // come back.
    return (
      <Flex align="center" minHeight={ROW_HEIGHT}>
        {/*
          Named by the label alone. The value is not known yet, and a caller
          with a fallback — "Anonymous User" while the record loads — would
          otherwise have the header assert a name it has not got.
        */}
        <VisuallyHidden>
          <Heading as="h2" size="lg" aria-label={label}>
            {value}
          </Heading>
        </VisuallyHidden>
        <Placeholder width={loadingWidth} height={TITLE_HEIGHT} />
      </Flex>
    );
  }

  const visibleTags = (tags ?? [])
    .map((tag, index) => ({tag, index}))
    .filter(
      (entry): entry is {index: number; tag: React.ReactElement<TagProps>} =>
        entry.tag !== null
    );

  return (
    <Flex align="center" gap="sm" minWidth={0} minHeight={ROW_HEIGHT}>
      {leadingGraphic && <LeadingGraphicSlot graphic={leadingGraphic} />}
      {/*
        Plain text, not a link. A heading that is wholly a link announces as
        both, and the breadcrumb above it already handles going up.
      */}
      <Heading
        as="h2"
        size="lg"
        density="comfortable"
        ellipsis
        aria-label={accessibleName}
      >
        {value}
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
