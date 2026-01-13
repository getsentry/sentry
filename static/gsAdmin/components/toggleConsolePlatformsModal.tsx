import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout/flex';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import {
  useConsoleSdkInvites,
  useRevokeConsoleSdkPlatformInvite,
  type ConsoleSdkInviteUser,
} from 'sentry/views/settings/organizationConsoleSdkInvites/hooks';

type ConsolePlatform = ConsoleSdkInviteUser['platforms'][number];

interface InviteRowProps {
  invite: ConsoleSdkInviteUser;
  onRevoke: (params: {email: string; platform: ConsolePlatform; userId: string}) => void;
  revokingPlatform: ConsolePlatform | null;
  revokingUserId: string | null;
}

function InviteRow({invite, onRevoke, revokingPlatform, revokingUserId}: InviteRowProps) {
  const {email, platforms, user_id} = invite;

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Link to={`/_admin/users/${user_id}`}>
          <Text wordBreak="break-all">{email}</Text>
        </Link>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Flex gap="sm">
          {platforms.map(platform => {
            const isPlatformRevoking =
              revokingUserId === user_id && revokingPlatform === platform;

            return (
              <Tag
                key={platform}
                variant="info"
                onDismiss={() => {
                  if (!isPlatformRevoking) {
                    onRevoke({userId: user_id, email, platform});
                  }
                }}
              >
                {platform}
              </Tag>
            );
          })}
        </Flex>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

interface InvitesTableProps {
  invites: ConsoleSdkInviteUser[];
  isError: boolean;
  isPending: boolean;
  onRefetch: () => void;
  onRevoke: (params: {email: string; platform: ConsolePlatform; userId: string}) => void;
  revokingPlatform: ConsolePlatform | null;
  revokingUserId: string | null;
}

function InvitesTableContent({
  invites,
  isPending,
  isError,
  onRefetch,
  onRevoke,
  revokingUserId,
  revokingPlatform,
}: InvitesTableProps) {
  if (isPending) {
    return (
      <SimpleTable.Empty>
        <LoadingIndicator />
      </SimpleTable.Empty>
    );
  }

  if (isError) {
    return (
      <SimpleTable.Empty>
        <LoadingError onRetry={onRefetch} />
      </SimpleTable.Empty>
    );
  }

  if (invites.length === 0) {
    return <SimpleTable.Empty>No invites found</SimpleTable.Empty>;
  }

  return invites.map(invite => (
    <InviteRow
      key={invite.user_id}
      invite={invite}
      onRevoke={onRevoke}
      revokingUserId={revokingUserId}
      revokingPlatform={revokingPlatform}
    />
  ));
}

interface ToggleConsolePlatformsModalProps extends ModalRenderProps {
  onSuccess: () => void;
  organization: Organization;
}

function ToggleConsolePlatformsModal({
  Header,
  Body,
  closeModal,
  organization,
  onSuccess,
}: ToggleConsolePlatformsModalProps) {
  const {enabledConsolePlatforms = [], consoleSdkInviteQuota = 0} = organization;

  const {
    data: userIdentities = [],
    isPending: isInvitesFetchPending,
    isError: isInvitesFetchError,
    refetch: refetchInvites,
  } = useConsoleSdkInvites(organization.slug);

  const {
    mutate: revokeConsoleInvite,
    isPending: isRevokePending,
    variables: revokeVariables,
  } = useRevokeConsoleSdkPlatformInvite();

  const {isPending: isUpdatePending, mutate: updateConsolePlatforms} = useMutation({
    mutationFn: (data: Record<string, boolean | number>) => {
      const {newConsoleSdkInviteQuota, ...platforms} = data;
      return fetchMutation({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data: {
          enabledConsolePlatforms: Object.keys(platforms).reduce((acc, key) => {
            if (platforms[key]) {
              acc.push(key);
            }
            return acc;
          }, [] as string[]),
          consoleSdkInviteQuota: newConsoleSdkInviteQuota,
        },
      });
    },
    onMutate: () => {
      addLoadingMessage(`Updating console platforms for ${organization.slug}\u2026`);
    },
    onSuccess: () => {
      addSuccessMessage(`Console platforms updated for ${organization.slug}`);
      onSuccess();
      closeModal();
    },
    onError: () => {
      addErrorMessage(`Failed to update console platforms for ${organization.slug}`);
    },
  });

  const handleRevoke = ({
    userId,
    email,
    platform,
  }: {
    email: string;
    platform: ConsolePlatform;
    userId: string;
  }) => {
    revokeConsoleInvite({
      userId,
      email,
      platform,
      orgSlug: organization.slug,
    });
  };

  return (
    <Form
      onSubmit={data => updateConsolePlatforms(data as Record<string, boolean | number>)}
      onCancel={closeModal}
      saveOnBlur={false}
      initialData={{
        playstation: enabledConsolePlatforms.includes('playstation'),
        'nintendo-switch': enabledConsolePlatforms.includes('nintendo-switch'),
        xbox: enabledConsolePlatforms.includes('xbox'),
        newConsoleSdkInviteQuota: consoleSdkInviteQuota,
      }}
      submitLabel="Save"
      submitDisabled={isUpdatePending}
    >
      <Header closeButton>
        <Flex align="center" gap="xl">
          <h4>Toggle Console Platforms</h4>
        </Flex>
      </Header>
      <Body>
        <p
          css={css`
            margin: 0;
          `}
        >
          Toggle consoles to allow users in this organization to create console projects
          and view private setup instructions.
        </p>
        <div
          css={css`
            margin: 0 -${space(4)};
          `}
        >
          <StyledFieldFromConfig
            field={{
              name: 'playstation',
              type: 'boolean',
              label: 'PlayStation',
              help: 'Toggle the PlayStation console platform for this organization.',
            }}
            flexibleControlStateSize
            inline
          />
          <StyledFieldFromConfig
            field={{
              name: 'nintendo-switch',
              type: 'boolean',
              label: 'Nintendo Switch',
              help: 'Toggle Nintendo Switch console platform for this organization.',
            }}
            flexibleControlStateSize
            inline
          />
          <StyledFieldFromConfig
            field={{
              name: 'xbox',
              type: 'boolean',
              label: 'Xbox',
              help: 'Toggle the Xbox console platform for this organization.',
            }}
            flexibleControlStateSize
            inline
          />
          <NumberFieldFromConfig
            field={{
              name: 'newConsoleSdkInviteQuota',
              type: 'number',
              label: 'GitHub Repo Invite Limit',
              help: `Set the maximum number of GitHub users that can be invited to our console SDK repositories. Currently ${userIdentities?.length ?? 0} of ${consoleSdkInviteQuota} invites used.`,
              min: 0,
            }}
            flexibleControlStateSize
            inline
          />
        </div>

        <SimpleTableWithColumns>
          <SimpleTable.Header>
            <SimpleTable.HeaderCell>User</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>Platforms</SimpleTable.HeaderCell>
          </SimpleTable.Header>
          <InvitesTableContent
            invites={userIdentities}
            isPending={isInvitesFetchPending}
            isError={isInvitesFetchError}
            onRefetch={refetchInvites}
            onRevoke={handleRevoke}
            revokingUserId={isRevokePending ? (revokeVariables?.userId ?? null) : null}
            revokingPlatform={
              isRevokePending ? (revokeVariables?.platform ?? null) : null
            }
          />
        </SimpleTableWithColumns>
      </Body>
    </Form>
  );
}

const StyledFieldFromConfig = styled(FieldFromConfig)`
  padding-left: ${space(4)};
  &:last-child {
    padding-bottom: 0;
  }
`;

const NumberFieldFromConfig = styled(FieldFromConfig)`
  padding-left: ${space(4)};
  > div {
    padding-right: ${space(4)};
  }
`;

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 2fr max-content;
`;

export function openToggleConsolePlatformsModal({
  organization,
  onSuccess,
}: {
  onSuccess: () => void;
  organization: Organization;
}) {
  return openModal(deps => (
    <ToggleConsolePlatformsModal
      {...deps}
      organization={organization}
      onSuccess={onSuccess}
    />
  ));
}
