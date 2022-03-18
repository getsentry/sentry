import styled from '@emotion/styled';

import tourTrace from 'sentry-images/spot/performance-tour-trace.svg';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {useMEPPageSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedPageSetting';

function handleClick() {}

export default function UnsampledSuspectSpans() {
  const {setMEPEnabled} = useMEPPageSettingContext();
  return (
    <StyledPanel dashedBorder>
      <div>
        <Description>
          <h3>{t('Find suspect spans and tags')}</h3>
          <p>
            {t(
              'Get a list of the slowest spans and tags for this transaction. These details can be shown based on sampled events.'
            )}
          </p>
        </Description>
        <ButtonList>
          <Button size="small" priority="primary" onClick={() => setMEPEnabled(false)}>
            {t('Switch to sampled')}
          </Button>
          <ButtonBar merged>
            <Button
              title={t('Learn more about sampled data.')}
              size="small"
              onClick={() => handleClick()}
            >
              {t('Learn More')}
            </Button>
          </ButtonBar>
        </ButtonList>
      </div>
      <div>
        <Image
          height={140}
          src={tourTrace}
          alt="switch to sampled to see suspect spans"
        />
      </div>
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  padding: ${space(3)};
  padding-bottom: ${space(1)};
  background: none;
  margin-bottom: ${space(1)};
  margin-top: ${space(1)};
  display: grid;
  align-content: space-between;
  align-items: start;
  grid-template-columns: repeat(auto-fit, minmax(256px, 1fr));
`;

const Description = styled('div')`
  h3 {
    font-size: 14px;
    text-transform: uppercase;
    margin-bottom: ${space(0.25)};
    color: ${p => p.theme.gray300};
  }
  p {
    font-size: 13px;
    font-weight: bold;
    color: ${p => p.theme.textColor};
    margin-bottom: ${space(1.5)};
  }
`;

const ButtonList = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  justify-self: end;
  margin-bottom: 16px;
`;

const Image = styled('img')`
  float: right;
`;
