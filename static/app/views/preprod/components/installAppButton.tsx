import type {MouseEvent} from 'react';

import {Button} from '@sentry/scraps/button';

import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {openInstallModal} from 'sentry/views/preprod/components/installModal';

interface InstallAppButtonProps {
  artifactId: string;
  projectId: string;
  source: 'build_details_sidebar' | 'builds_table';
  platform?: string | null;
  variant?: 'text' | 'icon';
}

export function InstallAppButton({
  artifactId,
  projectId,
  platform,
  source,
  variant = 'text',
}: InstallAppButtonProps) {
  const organization = useOrganization();
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.blur();
    trackAnalytics('preprod.builds.install_modal.opened', {
      organization,
      build_id: artifactId,
      platform,
      project_slug: projectId,
      source,
    });
    openInstallModal(projectId, artifactId);
  };

  if (variant === 'icon') {
    return (
      <Button
        aria-label={t('Install')}
        icon={<IconDownload size="sm" />}
        onClick={handleClick}
        priority="transparent"
        size="zero"
        title={t('Install')}
      />
    );
  }

  return (
    <Button
      onClick={handleClick}
      priority="link"
      size="sm"
      style={{fontWeight: 'normal'}}
    >
      {t('Install')}
    </Button>
  );
}
