import {VisuallyHidden} from '@react-aria/visually-hidden';

import {UserAvatar} from '@sentry/scraps/avatar';
import type {TagProps} from '@sentry/scraps/badge';
import {ROW_HEIGHT, TITLE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Container, Flex} from '@sentry/scraps/layout';
import type {LinkDestination} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ProjectsBadge} from 'sentry/components/core/badge/projectsBadge';
import {Placeholder} from 'sentry/components/placeholder';
import type {AvatarProject} from 'sentry/types/project';
import type {AvatarUser} from 'sentry/types/user';
import {defined} from 'sentry/utils/defined';
import {unreachable} from 'sentry/utils/unreachable';

import {EntityHeaderDestinationLink, toLinkDestination} from './entityHeaderText';

/**
 * A graphic is either named, with an optional tooltip, or decorative.
 */
type EntityHeaderLeadingGraphicBase =
  | {
      /**
       * Names the graphic for assistive technology. Give it one when the
       * graphic shows something the title does not, such as which projects a
       * trace touched.
       */
      label: string;
      /**
       * Hover content shown instead of `label`. The graphic is not focusable,
       * so the tooltip is mouse-only. Keep anything a user needs in `label`.
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
 * `project` and `platform` render the same badge. Use the one that matches the
 * data you have. A trace has its projects, but a build only has a platform
 * inferred from a file type.
 */
export type EntityHeaderLeadingGraphic =
  | ({type: 'user'; user: AvatarUser} & EntityHeaderLeadingGraphicBase)
  | ({projects: AvatarProject[]; type: 'project'} & EntityHeaderLeadingGraphicBase)
  | ({platform: string; type: 'platform'} & EntityHeaderLeadingGraphicBase);

interface EntityHeaderTitleBase {
  /**
   * What the value is, such as "Replay user" or "Issue type". Assistive
   * technology reads it before the value.
   *
   * It is not rendered. Sighted users get this from the graphic beside the
   * title and the breadcrumbs above it. Without it, a screen reader user who
   * jumps to the heading hears the value with no context. It means the same as
   * a stat's `label`, so it has the same name.
   */
  label: string;
  /**
   * The entity's name. Rendered as the page's `h2`, because the `h1` belongs
   * to the TopBar title slot.
   */
  value: string;
  /**
   * A 24px graphic before the title. Decorative unless it is given a label.
   */
  leadingGraphic?: EntityHeaderLeadingGraphic;
  /**
   * Status chips rendered inline after the value.
   * `null` entries are dropped so callers can inline conditionals.
   */
  tags?: Array<React.ReactElement<TagProps> | null>;
}

/**
 * A title declares whether it is a link rather than the component inferring it
 * from whether a destination is defined. Stats and metadata items work the
 * same way.
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
      // With a label, the slot is a named image and the badge inside it is
      // decorative, so a trace can say which projects it touched. Without a
      // label, the slot is hidden. A named `role="img"` is announced without
      // focus, so the slot is not a tab stop. A keyboard user could not
      // activate it or read anything more from it.
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
  // Named from both, so heading navigation reads "Replay user,
  // anonymous@example.com" rather than a bare email address. The comma makes a
  // screen reader pause. Visually hidden text inside the heading would be read
  // without a pause.
  const accessibleName = `${props.label}, ${props.value}`;
  if (props.isLoading) {
    // The heading stays in the accessibility tree with the label, which is
    // known before the data. Removing it would change the page's structure
    // when the data arrives, and a user navigating by heading during loading
    // would find no heading.
    return (
      <Flex align="center" minHeight={ROW_HEIGHT}>
        {/*
          Named by the label alone. The value is not known yet, and a caller's
          fallback, such as "Anonymous User" while the record loads, would
          otherwise be read as the entity's name.
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
        // The anchor sits outside the heading, because the focus ring is a
        // box-shadow painted beyond the anchor's box and `ellipsis` clips
        // everything inside the heading. `Container` sets a minimum width of
        // 0 so the anchor can still shrink as a flex item.
        <Container minWidth={0}>
          {containerProps => (
            // Named like the heading, so a links list reads "Replay user,
            // anonymous@example.com" rather than a bare address.
            <EntityHeaderDestinationLink
              destination={toLinkDestination(props)}
              aria-label={accessibleName}
              {...containerProps}
            >
              {heading}
            </EntityHeaderDestinationLink>
          )}
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
