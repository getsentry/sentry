import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {PlatformIntegration, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useProjectKeys} from 'sentry/utils/useProjectKeys';

type Props = {
  organization: Organization;
  platform?: PlatformIntegration;
  project?: Project;
};

export function DsnSection({organization, project, platform}: Props) {
  const projectKeys = useProjectKeys({
    orgSlug: organization.slug,
    projSlug: project?.slug,
  });

  if (!project) {
    return null;
  }

  if (projectKeys.isPending) {
    return (
      <SimpleContainer>
        <LoadingIndicator mini />
      </SimpleContainer>
    );
  }

  const dsn = projectKeys.data?.[0]?.dsn;

  if (!dsn) {
    return null;
  }

  const handleCopyDsn = () => {
    trackAnalytics('onboarding.dsn-copied', {
      organization,
      platform: platform?.name ?? 'unknown',
    });
  };

  return (
    <SimpleContainer>
      <StyledTextCopyInput onCopy={handleCopyDsn}>{dsn.public}</StyledTextCopyInput>
      <SnarkyText>{t('TL;DR, if you just need the DSN, there you go.')}</SnarkyText>
    </SimpleContainer>
  );
}

const SimpleContainer = styled('div')`
  margin-bottom: ${space(3)};
`;

const SnarkyText = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  margin: ${space(1)} 0 0 0;
`;

const StyledTextCopyInput = styled(TextCopyInput)`
  width: 100%;
`;
