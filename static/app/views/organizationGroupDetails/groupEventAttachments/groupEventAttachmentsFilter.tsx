import styled from '@emotion/styled';
import omit from 'lodash/omit';
import xor from 'lodash/xor';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {isMobilePlatform} from 'sentry/utils/platform';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const crashReportTypes = ['event.minidump', 'event.applecrashreport'];
const SCREENSHOT_TYPE = 'event.screenshot';

type Props = {
  project: Project;
};

const GroupEventAttachmentsFilter = (props: Props) => {
  const {project} = props;
  const {query, pathname} = useLocation();
  const {types} = query;
  const allAttachmentsQuery = omit(query, 'types');
  const onlyCrashReportsQuery = {
    ...query,
    types: crashReportTypes,
  };

  const organization = useOrganization();

  const onlyScreenshotQuery = {
    ...query,
    types: SCREENSHOT_TYPE,
  };

  let activeButton = '';

  if (types === undefined) {
    activeButton = 'all';
  } else if (types === SCREENSHOT_TYPE) {
    activeButton = 'screenshot';
  } else if (xor(crashReportTypes, types).length === 0) {
    activeButton = 'onlyCrash';
  }

  return (
    <FilterWrapper>
      <ButtonBar merged active={activeButton}>
        <Button barId="all" size="sm" to={{pathname, query: allAttachmentsQuery}}>
          {t('All Attachments')}
        </Button>
        {organization.features.includes('mobile-screenshot-gallery') &&
          isMobilePlatform(project.platform) && (
            <Button
              barId="screenshot"
              size="sm"
              to={{pathname, query: onlyScreenshotQuery}}
            >
              {t('Screenshots')}
            </Button>
          )}
        <Button barId="onlyCrash" size="sm" to={{pathname, query: onlyCrashReportsQuery}}>
          {t('Only Crash Reports')}
        </Button>
      </ButtonBar>
    </FilterWrapper>
  );
};

const FilterWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${space(3)};
`;

export {crashReportTypes, SCREENSHOT_TYPE};
export default GroupEventAttachmentsFilter;
