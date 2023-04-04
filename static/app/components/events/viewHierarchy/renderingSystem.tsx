import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';

type RenderingSystemProps = {
  platform?: string;
  system?: string;
};

const RenderingSystem = ({platform, system}: RenderingSystemProps) => {
  const organization = useOrganization();
  return (
    <Container>
      <Tooltip title={t('Rendering System: %s', system ?? t('Unknown'))}>
        <PlatformIcon
          onMouseEnter={() => {
            trackAdvancedAnalyticsEvent(
              'issue_details.view_hierarchy.hover_rendering_system',
              {
                organization,
                platform,
                user_org_role: organization.orgRole,
              }
            );
          }}
          data-test-id="rendering-system-icon"
          platform={platform ?? 'generic'}
          size={21}
          radius={null}
        />
      </Tooltip>
    </Container>
  );
};

export {RenderingSystem};

const Container = styled('div')`
  position: absolute;
  top: -0.5px;
  left: -${space(3)};
  z-index: 1;

  img {
    border-radius: 4px 0 0 4px;
  }
`;
