import styled from '@emotion/styled';

import bannerStar from 'sentry-images/spot/banner-star.svg';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/core/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

export default function AllViewsWelcomeBanner() {
  const organization = useOrganization();

  const {isPromptDismissed, isLoading, isError, dismissPrompt} = usePrompt({
    feature: 'issue_views_all_views_banner',
    organization,
  });

  return isPromptDismissed || isLoading || isError ? null : (
    <Banner>
      <BannerStar1 src={bannerStar} />
      <BannerStar2 src={bannerStar} />
      <BannerStar3 src={bannerStar} />
      <BannerTitle>
        {t('Welcome to the new All Views page')}
        <DismissButton
          analyticsEventKey="issue_views.all_views.banner_dismissed"
          analyticsEventName="Issue Views: All Views Banner Dismissed"
          size="zero"
          borderless
          icon={<IconClose size="xs" />}
          aria-label={t('Dismiss')}
          onClick={() => dismissPrompt()}
        />
      </BannerTitle>
      <BannerSubTitle>
        <div>
          {t(
            'Issue Views are now visible to everyone in your organization, making it easier to share key workflows.'
          )}
        </div>
        <div>{t('A few notes to help you get started:')}</div>
        <AFewNotesList>
          <li>
            <BannerNoteBold>
              {t('All views are shared with everyone in your organization. ')}
            </BannerNoteBold>
            {t('Only creators and admins can edit or delete them. ')}
          </li>
          <li>
            <BannerNoteBold>
              {t('Star views from yourself or others for easy access. ')}
            </BannerNoteBold>
            {t('Starred views appear in the navigation to the left.')}
          </li>
        </AFewNotesList>
      </BannerSubTitle>
    </Banner>
  );
}
const Banner = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  margin-top: ${space(2)};
  margin-bottom: 0;
  padding: 12px;
  gap: ${space(0.5)};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
`;

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BannerSubTitle = styled('div')`
  display: flex;
  flex-direction: column;
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  gap: ${space(0.5)};
`;

const BannerNoteBold = styled('div')`
  display: inline;
  font-weight: ${p => p.theme.fontWeight.bold};
`;
const BannerStar1 = styled('img')`
  position: absolute;
  bottom: 10px;
  right: 150px;
  transform: scale(0.9);

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    display: none;
  }
`;
const BannerStar2 = styled('img')`
  position: absolute;
  top: 10px;
  right: 120px;
  transform: rotate(-30deg) scale(0.7);

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    display: none;
  }
`;
const BannerStar3 = styled('img')`
  position: absolute;
  bottom: 30px;
  right: 80px;
  transform: rotate(80deg) scale(0.6);

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    display: none;
  }
`;

const AFewNotesList = styled('ul')`
  margin-bottom: ${space(0.5)};
`;
const DismissButton = styled(Button)`
  position: absolute;
  top: ${space(1)};
  right: ${space(1)};
  color: ${p => p.theme.subText};
`;
