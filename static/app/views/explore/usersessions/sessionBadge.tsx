import {UserAvatar} from '@sentry/scraps/avatar';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {IconCode} from 'sentry/icons/iconCode';
import {IconLocation} from 'sentry/icons/iconLocation';
import {IconUser} from 'sentry/icons/iconUser';

import type {SessionName} from './sessionName';

const AVATAR_SIZE = 24;

/**
 * The glyph carries what kind of thing the subject is, so a row reads as a
 * person, a place or a runtime before the text is read at all.
 */
function SubjectGlyph({name}: {name: SessionName}) {
  if (name.subjectKind === 'user' && name.user) {
    return <UserAvatar user={name.user} size={AVATAR_SIZE} />;
  }

  const Icon =
    name.subjectKind === 'location'
      ? IconLocation
      : name.subjectKind === 'sdk'
        ? IconCode
        : IconUser;

  return (
    <Flex align="center" justify="center" width={`${AVATAR_SIZE}px`}>
      <Icon variant="muted" size="sm" />
    </Flex>
  );
}

interface Props {
  name: SessionName;
  /**
   * Rendered against the handle, for a control that acts on the id itself — a
   * copy button, most usefully. It sits inside the badge rather than after it so
   * its position is set by the handle's width, not by however wide the badge
   * happens to be.
   */
  action?: React.ReactNode;
  /** Renders the subject as a placeholder while the naming attributes load. */
  isPending?: boolean;
  /** Extra detail appended to the secondary line. */
  trailing?: React.ReactNode;
}

/**
 * Names a session: a subject resolved from its telemetry on top, and the handle
 * that actually identifies it underneath.
 *
 * Both lines are needed because they do different jobs. The subject is what you
 * scan a list by; it is not unique, since one person has many sessions. The
 * handle is unique and is what you paste into a ticket, but it says nothing.
 */
export function SessionBadge({name, isPending, action, trailing}: Props) {
  return (
    <Grid columns={`${AVATAR_SIZE}px minmax(0, 1fr)`} gap="md" align="center">
      <SubjectGlyph name={name} />
      <Stack gap="xs" justify="center">
        {isPending ? (
          <Placeholder height="1em" width="140px" />
        ) : (
          <Text size="md" bold ellipsis variant="inherit" title={name.subject}>
            {name.subject}
          </Text>
        )}
        {/*
          The tokens on this line are short by construction, and `ellipsis` sets
          `width: 100%` — two of them side by side would each claim the whole line
          and leave a gap between them rather than truncating. The line clips as a
          whole instead, which the grid column above already bounds.
        */}
        <Flex gap="xs" align="center" minWidth="0" overflow="hidden">
          <Text size="sm" variant="muted" monospace wrap="nowrap">
            {name.handle}
          </Text>
          {action}
          {name.context ? (
            <Text size="sm" variant="muted" wrap="nowrap">
              {name.context}
            </Text>
          ) : null}
          {trailing}
        </Flex>
      </Stack>
    </Grid>
  );
}
