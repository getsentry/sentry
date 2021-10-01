import {Fragment} from 'react';
import * as React from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import LoadingIndicator from 'app/components/loadingIndicator';
import {PanelItem} from 'app/components/panels';
import PanelTable from 'app/components/panels/panelTable';
import UserMisery from 'app/components/userMisery';
import {backend, frontend, mobile, serverless} from 'app/data/platformCategories';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, ReleaseProject} from 'app/types';
import {MobileVital, WebVital} from 'app/utils/discover/fields';
import {
  MOBILE_VITAL_DETAILS,
  WEB_VITAL_DETAILS,
} from 'app/utils/performance/vitals/constants';

const FRONTEND_PLATFORMS: string[] = [...frontend];
const BACKEND_PLATFORMS: string[] = [...backend, ...serverless];
const MOBILE_PLATFORMS: string[] = [...mobile];

type Props = {
  organization: Organization;
  project: ReleaseProject;
  isLoading: boolean;
  isEmpty: boolean;
};

class PerformanceCardTable extends React.PureComponent<Props> {
  userMiseryField() {
    return (
      <UserMiseryPanelItem>
        <StyledUserMisery
          bars={10}
          barHeight={20}
          miseryLimit={1000}
          totalUsers={500}
          userMisery={300}
          miserableUsers={200}
        />
      </UserMiseryPanelItem>
    );
  }

  sectionField(field: JSX.Element[]) {
    return (
      <StyledPanelItem>
        <TitleSpace />
        {field}
      </StyledPanelItem>
    );
  }

  renderFrontendPerformance() {
    const vitals = [WebVital.FCP, WebVital.FID, WebVital.LCP, WebVital.CLS];
    const webVitalTitles = vitals.map(vital => {
      return (
        <SubTitle key={vital}>
          {WEB_VITAL_DETAILS[vital].name} ({WEB_VITAL_DETAILS[vital].acronym})
        </SubTitle>
      );
    });

    const spans = ['HTTP', 'DB', 'Browser', 'Resource'];
    const spanTitles = spans.map(span => {
      return <SubTitle key={span}>{t(span)}</SubTitle>;
    });

    // TODO(kelly): placeholder data. will need to add discover data for webvitals and span operations in follow-up pr
    const fieldData = ['0ms', '0ms', '0ms', '0ms'];
    const field = fieldData.map(data => {
      return (
        <Field key={data} align="right">
          {data}
        </Field>
      );
    });

    const columnData = () => {
      return (
        <div>
          {this.userMiseryField()}
          {this.sectionField(field)}
          {this.sectionField(field)}
        </div>
      );
    };

    return (
      <Fragment>
        <div>
          {/* Table description column */}
          <PanelItem>{t('User Misery')}</PanelItem>
          <StyledPanelItem>
            <div>{t('Web Vitals')}</div>
            {webVitalTitles}
          </StyledPanelItem>
          <StyledPanelItem>
            <div>{t('Span Operations')}</div>
            {spanTitles}
          </StyledPanelItem>
        </div>
        <div>
          {/* Table All Releases column */}
          {/* TODO(kelly): placeholder data. will need to add user misery data in follow-up pr */}
          {columnData()}
        </div>
        <div>
          {/* Table This Release column */}
          {columnData()}
        </div>
        <div>
          {/* Table Change column */}
          {columnData()}
        </div>
      </Fragment>
    );
  }

  renderBackendPerformance() {
    const spans = ['HTTP', 'DB'];
    const spanTitles = spans.map(span => {
      return <SubTitle key={span}>{t(span)}</SubTitle>;
    });

    // TODO(kelly): placeholder data. will need to add discover data for webvitals and span operations in follow-up pr
    const apdexData = ['0ms'];
    const apdexField = apdexData.map(data => {
      return (
        <Field key={data} align="right">
          {data}
        </Field>
      );
    });

    const fieldData = ['0ms', '0ms'];
    const field = fieldData.map(data => {
      return (
        <Field key={data} align="right">
          {data}
        </Field>
      );
    });

    const columnData = () => {
      return (
        <div>
          {this.userMiseryField()}
          <StyledPanelItem>{apdexField}</StyledPanelItem>
          {this.sectionField(field)}
        </div>
      );
    };

    return (
      <Fragment>
        <div>
          {/* Table description column */}
          <PanelItem>{t('User Misery')}</PanelItem>
          <StyledPanelItem>
            <div>{t('Apdex')}</div>
          </StyledPanelItem>
          <StyledPanelItem>
            <div>{t('Span Operations')}</div>
            {spanTitles}
          </StyledPanelItem>
        </div>
        <div>
          {/* Table All Releases column */}
          {/* TODO(kelly): placeholder data. will need to add user misery data in follow-up pr */}
          {columnData()}
        </div>
        <div>
          {/* Table This Release column */}
          {columnData()}
        </div>
        <div>
          {/* Table Change column */}
          {columnData()}
        </div>
      </Fragment>
    );
  }

  renderMobilePerformance() {
    const mobileVitals = [
      MobileVital.AppStartCold,
      MobileVital.AppStartWarm,
      MobileVital.FramesSlow,
      MobileVital.FramesFrozenRate,
    ];
    const mobileVitalTitles = mobileVitals.map(mobileVital => {
      return (
        <PanelItem key={mobileVital}>{MOBILE_VITAL_DETAILS[mobileVital].name}</PanelItem>
      );
    });

    // TODO(kelly): placeholder data. will need to add mobile data for mobilevitals in follow-up pr
    const mobileData = ['0ms'];
    const mobileField = mobileData.map(data => {
      return (
        <Field key={data} align="right">
          {data}
        </Field>
      );
    });
    const field = mobileVitals.map(vital => {
      return <StyledPanelItem key={vital}>{mobileField}</StyledPanelItem>;
    });

    const columnData = () => {
      return (
        <div>
          {this.userMiseryField()}
          {field}
        </div>
      );
    };

    return (
      <Fragment>
        <div>
          {/* Table description column */}
          <PanelItem>{t('User Misery')}</PanelItem>
          {mobileVitalTitles}
        </div>
        <div>
          {/* Table All Releases column */}
          {/* TODO(kelly): placeholder data. will need to add user misery data in follow-up pr */}
          {columnData()}
        </div>
        <div>
          {/* Table This Release column */}
          {columnData()}
        </div>
        <div>
          {/* Table Change column */}
          {columnData()}
        </div>
      </Fragment>
    );
  }

  renderUnknownPerformance() {
    return (
      <Fragment>
        <div>
          {/* Table description column */}
          <PanelItem>{t('User Misery')}</PanelItem>
        </div>
        <div>
          {/* TODO(kelly): placeholder data. will need to add user misery data in follow-up pr */}
          {this.userMiseryField()}
        </div>
        <div>
          {/* Table All Releases column */}
          {this.userMiseryField()}
        </div>
        <div>
          {/* Table This Release column */}
          {this.userMiseryField()}
        </div>
      </Fragment>
    );
  }

  render() {
    const {project, organization, isLoading, isEmpty} = this.props;
    // Custom set the height so we don't have layout shift when results are loaded.
    const loader = <LoadingIndicator style={{margin: '70px auto'}} />;

    const title = FRONTEND_PLATFORMS.includes(project.platform as string)
      ? t('Frontend Performance')
      : BACKEND_PLATFORMS.includes(project.platform as string)
      ? t('Backend Performance')
      : MOBILE_PLATFORMS.includes(project.platform as string)
      ? t('Mobile Performance')
      : t('[Unknown] Performance');
    const platformPerformance = FRONTEND_PLATFORMS.includes(project.platform as string)
      ? this.renderFrontendPerformance()
      : BACKEND_PLATFORMS.includes(project.platform as string)
      ? this.renderBackendPerformance()
      : MOBILE_PLATFORMS.includes(project.platform as string)
      ? this.renderMobilePerformance()
      : this.renderUnknownPerformance();

    return (
      <Fragment>
        <HeadCellContainer>{title}</HeadCellContainer>
        {title.includes(t('Unknown')) ? (
          <StyledAlert type="warning" icon={<IconWarning size="md" />} system>
            For more performance metrics, specify which platform this project is using in{' '}
            <Link to={`/settings/${organization.slug}/projects/${project.slug}/`}>
              project settings.
            </Link>
          </StyledAlert>
        ) : null}
        <StyledPanelTable
          isLoading={isLoading}
          isEmpty={isEmpty}
          emptyMessage={t('No transactions found')}
          headers={[
            <Cell key="description" align="left">
              {t('Description')}
            </Cell>,
            <Cell key="releases" align="right">
              {t('All Releases')}
            </Cell>,
            <Cell key="release" align="right">
              {t('This Release')}
            </Cell>,
            <Cell key="change" align="right">
              {t('Change')}
            </Cell>,
          ]}
          disablePadding
          loader={loader}
          disableTopBorder={title.includes('Unknown')}
        >
          {platformPerformance}
        </StyledPanelTable>
      </Fragment>
    );
  }
}

const HeadCellContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
  border-left: 1px solid ${p => p.theme.border};
  border-right: 1px solid ${p => p.theme.border};
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
`;

const StyledPanelTable = styled(PanelTable)<{disableTopBorder: boolean}>`
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-top: ${p => (p.disableTopBorder ? 'none' : `1px solid ${p.theme.border}`)};
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: min-content 1fr 1fr 1fr;
  }
`;

const StyledPanelItem = styled(PanelItem)`
  display: block;
`;

const SubTitle = styled('div')`
  margin-left: ${space(3)};
`;

const TitleSpace = styled('div')`
  height: 24px;
`;

const StyledUserMisery = styled(UserMisery)`
  ${PanelItem} {
    justify-content: flex-end;
  }
`;

const UserMiseryPanelItem = styled(PanelItem)`
  justify-content: flex-end;
`;

const Field = styled('div')<{align: 'left' | 'right'}>`
  text-align: ${p => p.align};
  margin-left: ${p => p.align === 'left' && space(2)};
`;

const Cell = styled('div')<{align: 'left' | 'right'}>`
  text-align: ${p => p.align};
  margin-left: ${p => p.align === 'left' && space(2)};
  padding-right: ${p => p.align === 'right' && space(2)};
  ${overflowEllipsis}
`;

const StyledAlert = styled(Alert)`
  border-top: 1px solid ${p => p.theme.border};
  border-right: 1px solid ${p => p.theme.border};
  border-left: 1px solid ${p => p.theme.border};
  margin-bottom: 0;
`;

export default PerformanceCardTable;
