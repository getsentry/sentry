import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {LinkButton} from '@sentry/scraps/button';
import {withFieldGroup} from '@sentry/scraps/form';
import {Container as LayoutContainer} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {EditableText} from 'sentry/components/editableText';
import {EditLayout} from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DeleteDetectorAction,
  DisableDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';
import {TopBar} from 'sentry/views/navigation/topBar';

interface DetectorLayoutProps {
  children: React.ReactNode;
  detectorType: DetectorType;
  submitButton: React.ReactNode;
  detector?: Detector;
  extraFooterButton?: React.ReactNode;
  previewChart?: React.ReactNode;
}

export const DetectorFormLayout = withFieldGroup({
  defaultValues: {name: ''},
  props: {} as DetectorLayoutProps,
  render: function DetectorFormLayout({
    group,
    children,
    detectorType,
    detector,
    submitButton,
    extraFooterButton,
    previewChart,
  }) {
    const organization = useOrganization();
    const theme = useTheme();
    const {setHasSetDetectorName} = useDetectorFormContext();
    const canEdit = useCanEditDetector({
      detectorType,
      projectId: detector?.projectId ?? null,
    });
    const maxWidth = theme.breakpoints.xl;
    return (
      <Fragment>
        <EditLayout.Header maxWidth={maxWidth}>
          <TopBar.Slot name="title">
            <Breadcrumbs
              crumbs={[
                {
                  label: t('Monitors'),
                  to: makeMonitorBasePathname(organization.slug),
                },
                {
                  label: getDetectorTypeLabel(detectorType),
                  to: makeMonitorTypePathname(organization.slug, detectorType),
                },
                {
                  label: (
                    <group.AppField name="name">
                      {field => (
                        <field.Base>
                          {({ref: _ref, ...baseProps}) => (
                            <Text as="div" bold>
                              <EditableText
                                {...baseProps}
                                allowEmpty
                                value={field.state.value}
                                onChange={value => {
                                  setHasSetDetectorName(true);
                                  field.handleChange(value);
                                }}
                                placeholder={t('New Monitor')}
                                aria-label={t('Monitor Name')}
                                variant="compact"
                              />
                            </Text>
                          )}
                        </field.Base>
                      )}
                    </group.AppField>
                  ),
                },
              ]}
            />
          </TopBar.Slot>
          <LayoutContainer>
            <MonitorFeedbackButton />
          </LayoutContainer>
          {previewChart && (
            <EditLayout.HeaderFields>{previewChart}</EditLayout.HeaderFields>
          )}
        </EditLayout.Header>
        <EditLayout.Body maxWidth={maxWidth}>{children}</EditLayout.Body>
        <EditLayout.Footer
          maxWidth={maxWidth}
          label={detector ? undefined : t('Step 2 of 2')}
        >
          {detector ? (
            <Fragment>
              <DisableDetectorAction detector={detector} />
              <DeleteDetectorAction detector={detector} />
              {extraFooterButton}
              {(canEdit || !!extraFooterButton) && <Separator orientation="vertical" />}
              <LinkButton
                variant="secondary"
                size="sm"
                to={makeMonitorDetailsPathname(organization.slug, detector.id)}
              >
                {t('Cancel')}
              </LinkButton>
            </Fragment>
          ) : (
            <Fragment>
              <LinkButton
                variant="secondary"
                to={`${makeMonitorBasePathname(organization.slug)}new/`}
              >
                {t('Back')}
              </LinkButton>
              {extraFooterButton}
            </Fragment>
          )}
          {submitButton}
        </EditLayout.Footer>
      </Fragment>
    );
  },
});
