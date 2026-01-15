import {useState} from 'react';
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
import {Alert} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout/flex';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {CONSOLE_PLATFORM_METADATA} from 'sentry/constants/consolePlatforms';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import {
  useConsoleSdkInvites,
  useRevokeConsoleSdkPlatformInvite,
  type ConsoleSdkInviteUser,
} from 'sentry/views/settings/organizationConsoleSdkInvites/hooks';

type ConsolePlatform = ConsoleSdkInviteUser['platforms'][number];

function QuotaAlert() {
  const playstation = useFormField<boolean>('playstation');
  const nintendoSwitch = useFormField<boolean>('nintendo-switch');
  const xbox = useFormField<boolean>('xbox');
  const quota = useFormField<string | number>('newConsoleSdkInviteQuota');

  const hasEnabledPlatform = playstation || nintendoSwitch || xbox;
  const isQuotaZero = quota === 0 || quota === '0';

  if (!hasEnabledPlatform || !isQuotaZero) {
    return null;
  }

  return (
    <StyledQuotaAlert variant="warning">
      You have enabled console platforms but the invite quota is set to 0. Users won't be
      able to request access to the console SDK repositories.
    </StyledQuotaAlert>
  );
}

interface InviteRowProps {
  invite: ConsoleSdkInviteUser;
  onRevoke: (params: {platform: ConsolePlatform; userId: string}) => void;
}

function InviteRow({invite, onRevoke}: InviteRowProps) {
  const {email, platforms, user_id} = invite;

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Link to={`/_admin/users/${user_id}`}>
          <Text wordBreak="break-all">{email}</Text>
        </Link>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Flex gap="sm" wrap="wrap">
          {platforms.map(platform => {
            const displayName =
              CONSOLE_PLATFORM_METADATA[platform]?.displayName ?? platform;

            return (
              <Tag
                key={platform}
                variant="info"
                onDismiss={() => onRevoke({userId: user_id, platform})}
              >
                {displayName}
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
  onRevoke: (params: {platform: ConsolePlatform; userId: string}) => void;
}

function InvitesTableContent({
  invites,
  isPending,
  isError,
  onRefetch,
  onRevoke,
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
    <InviteRow key={invite.user_id} invite={invite} onRevoke={onRevoke} />
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

  const [pendingRevocations, setPendingRevocations] = useState(
    new Map<string, Set<ConsolePlatform>>()
  );

  const {
    data: userInvites = [],
    isPending: isInvitesFetchPending,
    isError: isInvitesFetchError,
    refetch: refetchInvites,
  } = useConsoleSdkInvites(organization.slug);

  // Filter out pending revocations from displayed invites
  const displayedInvites = userInvites
    .map(invite => {
      const pendingForUser = pendingRevocations.get(invite.user_id);
      if (!pendingForUser) {
        return invite;
      }
      const filteredPlatforms = invite.platforms.filter(p => !pendingForUser.has(p));
      return {...invite, platforms: filteredPlatforms};
    })
    .filter(invite => invite.platforms.length > 0);

  const {mutateAsync: revokeConsoleInvites} = useRevokeConsoleSdkPlatformInvite();

  const queryClient = useQueryClient();

  const {isPending: isUpdatePending, mutateAsync: updateConsolePlatforms} = useMutation({
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
  });

  const handleRevoke = ({
    userId,
    platform,
  }: {
    platform: ConsolePlatform;
    userId: string;
  }) => {
    setPendingRevocations(prev => {
      const next = new Map(prev);
      const newPlatforms = new Set(prev.get(userId));
      newPlatforms.add(platform);
      next.set(userId, newPlatforms);
      return next;
    });
  };

  const handleSubmit = async (data: Record<string, boolean | number>) => {
    addLoadingMessage('Saving changes...');

    const promises: Array<Promise<unknown>> = [];
    pendingRevocations.forEach((platforms, userId) => {
      if (platforms.size <= 0) {
        return;
      }
      promises.push(
        revokeConsoleInvites({
          orgSlug: organization.slug,
          userId,
          platforms: Array.from(platforms),
        })
      );
    });
    promises.push(updateConsolePlatforms(data));

    await Promise.all(promises)
      .then(() => {
        addSuccessMessage('Console SDK settings updated successfully');
        closeModal();
        onSuccess();
      })
      .catch(() => {
        addErrorMessage('Failed to update console SDK settings');
      })
      .finally(() => {
        queryClient.invalidateQueries({
          queryKey: [`/organizations/${organization.slug}/console-sdk-invites/`],
        });
      });
  };

  return (
    <Form
      onSubmit={data => handleSubmit(data as Record<string, boolean | number>)}
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
              help: `Set the maximum number of GitHub users that can be invited to our console SDK repositories. Currently ${userInvites?.length ?? 0} of ${consoleSdkInviteQuota} invites used.`,
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
            invites={displayedInvites}
            isPending={isInvitesFetchPending}
            isError={isInvitesFetchError}
            onRefetch={refetchInvites}
            onRevoke={handleRevoke}
          />
        </SimpleTableWithColumns>

        <QuotaAlert />
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
  grid-template-columns: 1fr 1fr;
`;

const StyledQuotaAlert = styled(Alert)`
  margin-top: ${space(2)};
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
