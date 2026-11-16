import {VisuallyHidden} from '@react-aria/visually-hidden';

import {UserAvatar} from '@sentry/scraps/avatar';
import type {TagProps} from '@sentry/scraps/badge';
import {ROW_HEIGHT, TITLE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Container, Flex} from '@sentry/scraps/layout';
import type {LinkDestination} from '@sentry/scraps/link';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ProjectsBadge} from 'sentry/components/core/badge/projectsBadge';
import {Placeholder} from 'sentry/components/placeholder';
import type {AvatarProject} from 'sentry/types/project';
import type {AvatarUser} from 'sentry/types/user';
import {defined} from 'sentry/utils/defined';
import {unreachable} from 'sentry/utils/unreachable';

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

interface EntityHeaderTitleBase {
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
   * Status chips rendered inline after the label.
   * `null` entries are dropped so callers can inline conditionals.
   */
  tags?: Array<React.ReactElement<TagProps> | null>;
}

/**
 * A title declares whether it navigates, rather than the component inferring
 * it from a destination that happens to be defined — the same reason a stat
 * and a metadata item do.
 */
export type EntityHeaderTitleProps = EntityHeaderTitleBase &
  (
    | {type: 'text'}
    /**
     * Where the entity's name leads: usually the list it came from, filtered
     * to it, or an `externalHref` when the destination sits outside the
     * product.
     */
    | ({type: 'link'} & LinkDestination)
  );

function LeadingGraphic({graphic}: {graphic: EntityHeaderLeadingGraphic}) {
  switch (graphic.type) {
    case 'user':
      return <UserAvatar user={graphic.user} size={20} />;
    case 'project': {
      const platforms = graphic.projects.map(project => project.platform).filter(defined);
      return (
        <ProjectsBadge
          projectPlatforms={platforms.length > 0 ? platforms : ['default']}
          size="lg"
        />
      );
    }
    case 'platform':
      return <ProjectsBadge projectPlatforms={[graphic.platform]} size="lg" />;
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
      width="24px"
      height="24px"
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

export function EntityHeaderTitle(props: EntityHeaderTitleProps & {isLoading?: boolean}) {
  // Named from both, so heading navigation lands on "Replay user,
  // anonymous@example.com" rather than on an email address with no frame. The
  // comma is what gives a screen reader its pause; visually hidden text inside
  // the heading would read as one run.
  const accessibleName = `${props.label}, ${props.value}`;
  if (props.isLoading) {
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
          <Heading as="h2" size="lg" aria-label={props.label}>
            {props.value}
          </Heading>
        </VisuallyHidden>
        <Placeholder width="240px" height={TITLE_HEIGHT} />
      </Flex>
    );
  }

  const visibleTags = (props.tags ?? [])
    .map((tag, index) => ({tag, index}))
    .filter(entry => entry.tag !== null);

  const heading = (
    <Heading
      as="h2"
      size="lg"
      density="comfortable"
      ellipsis
      variant={props.type === 'link' ? 'accent' : undefined}
      aria-label={accessibleName}
    >
      {props.value}
    </Heading>
  );

  return (
    <Flex align="center" gap="sm" minWidth={0} minHeight={ROW_HEIGHT}>
      {props.leadingGraphic && <LeadingGraphicSlot graphic={props.leadingGraphic} />}
      {props.type === 'link' ? (
        // The anchor sits outside the element that clips, because the focus
        // ring is a box-shadow painted beyond its own box and `ellipsis`
        // clips everything inside the heading. `Container` floors the
        // anchor's width so it still shrinks as a flex item.
        <Container minWidth={0}>
          {containerProps =>
            // Named like the heading, so a links list reads "Replay user,
            // anonymous@example.com" rather than a bare address.
            props.externalHref === undefined ? (
              <Link to={props.to} aria-label={accessibleName} {...containerProps}>
                {heading}
              </Link>
            ) : (
              <ExternalLink
                href={props.externalHref}
                aria-label={accessibleName}
                {...containerProps}
              >
                {heading}
              </ExternalLink>
            )
          }
        </Container>
      ) : (
        heading
      )}
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
