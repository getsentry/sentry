import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import * as Layout from 'sentry/components/layouts/thirds';
import {IconCommit, IconPullRequest, IconShow, IconStack} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import type {Theme} from 'sentry/utils/theme';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';
import {getBranchUrl, getPrUrl, getShaUrl} from 'sentry/views/preprod/utils/vcsLinkUtils';

interface VcsItemConfig {
  icon: React.ComponentType<SVGIconProps>;
  key: string;
  label: string;
  href?: string | null;
  monospace?: boolean;
  requiresHref?: boolean;
}

interface SnapshotHeaderContentProps {
  data: SnapshotDetailsApiResponse;
  isSoloView: boolean;
  onToggleView: () => void;
}

export function SnapshotHeaderContent({
  data,
  isSoloView,
  onToggleView,
}: SnapshotHeaderContentProps) {
  const {vcs_info} = data;
  const shortSha = vcs_info.head_sha?.slice(0, 7);

  const vcsItems: VcsItemConfig[] = [
    {
      key: 'pr',
      icon: IconPullRequest,
      label: vcs_info.pr_number ? `#${vcs_info.pr_number}` : '',
      href: getPrUrl(vcs_info),
      requiresHref: true,
    },
    {
      key: 'sha',
      icon: IconCommit,
      label: shortSha ?? '',
      href: getShaUrl(vcs_info, vcs_info.head_sha),
      monospace: true,
      requiresHref: true,
    },
    {
      key: 'branch',
      icon: IconStack,
      label: vcs_info.head_ref ?? '',
      href: getBranchUrl(vcs_info, vcs_info.head_ref),
    },
  ].filter(item => item.label && (!item.requiresHref || item.href));

  return (
    <Layout.HeaderContent>
      <Layout.Title>{t('Snapshot')}</Layout.Title>

      {vcsItems.length > 0 && (
        <Flex align="center" gap="lg" wrap="wrap">
          {vcsItems.map(item => (
            <Flex align="center" gap="xs" key={item.key}>
              <item.icon size="xs" />
              {item.href ? (
                <ExternalLink href={item.href}>
                  <Text size="sm" variant="accent" monospace={item.monospace}>
                    {item.label}
                  </Text>
                </ExternalLink>
              ) : (
                <Text size="sm">{item.label}</Text>
              )}
            </Flex>
          ))}
        </Flex>
      )}

      {data.comparison_type === 'diff' && data.base_artifact_id && (
        <Flex align="center" gap="sm" padding="sm 0">
          <Text size="sm" variant="muted" bold>
            {t('Comparing:')}
          </Text>
          <PillButton
            size="xs"
            icon={<IconShow variant={isSoloView ? undefined : 'accent'} />}
            priority={isSoloView ? 'primary' : 'default'}
            onClick={onToggleView}
            aria-pressed={isSoloView}
          >
            {t('Head')}
          </PillButton>
          <Text size="sm" variant="muted" bold>
            {t('vs')}
          </Text>
          <PillLinkButton
            size="xs"
            icon={<IconShow variant="accent" />}
            priority="default"
            to={normalizeUrl(`/preprod/snapshots/${data.base_artifact_id}/`)}
          >
            {t('Base')}
          </PillLinkButton>
        </Flex>
      )}
    </Layout.HeaderContent>
  );
}

const pillStyle = (p: {theme: Theme}) => css`
  border-radius: ${p.theme.radius.full};
`;

const PillButton = styled(Button)`
  ${pillStyle}
`;

const PillLinkButton = styled(LinkButton)`
  ${pillStyle}
`;
