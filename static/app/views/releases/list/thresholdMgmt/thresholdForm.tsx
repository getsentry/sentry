import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import PanelTable from 'sentry/components/panels/panelTable';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project, SelectValue} from 'sentry/types';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import SlideOverPanel from 'sentry/views/starfish/components/slideOverPanel';

import StyledIdBadge from '../../components/styledIdBadge';
import {parseSeconds} from '../../utils';
import {Threshold} from '../../utils/types';
import useFetchThresholdsListData from '../../utils/useFetchThresholdsListData';

type Props = {
  allEnvs: string[];
  selectedEnvs: string[];
  selectedProjects: Project[];
  formData?: {[key: string]: any};
  onClose?: () => void;
  onOpen?: () => void;
};

type FormData = {
  environment?: string;
  project?: string;
  thresholds?: Threshold[];
  windowUnit?: string;
  windowVal?: number;
};

export default function ThresholdForm({
  allEnvs,
  formData: propFormData = undefined,
  selectedEnvs,
  selectedProjects,
  onClose,
  onOpen,
}: Props) {
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({});
  const escapeKeyPressed = useKeyPress('Escape');
  // TODO: refetch all thresholds on form update?
  // NOTE: not fetching based on environments - env is filtered client side
  const {data: thresholds = [], isLoading} = useFetchThresholdsListData({
    selectedProjectIds: selectedProjects.map(p => parseInt(p.id, 10)),
  });

  const getSelectedThresholds = (projectId: string, environment: string) =>
    thresholds.filter(
      threshold =>
        threshold.project.id === projectId && threshold.environment.name === environment
    );

  const getSelectedThresholdsCB = useCallback(getSelectedThresholds, [thresholds]);

  // Any time the key prop changes (due to user interaction), we want to open the panel
  useEffect(() => {
    if (propFormData) {
      setFormOpen(true);
      // initialize form data

      const project =
        propFormData.project || selectedProjects.length === 1
          ? selectedProjects[0].id
          : '';
      const environment =
        propFormData.environment || selectedEnvs.length === 1 ? selectedEnvs[0] : '';
      const selectedThresholds = getSelectedThresholdsCB(project, environment);
      const [unit, val] = selectedThresholds.length
        ? parseSeconds(selectedThresholds[0].window_in_seconds)
        : ['min', 0];
      setFormData({
        project,
        environment,
        windowUnit: propFormData.windowUnit || unit,
        windowVal: propFormData.windowVal || val,
        thresholds: propFormData.thresholds || selectedThresholds,
      });
    } else {
      setFormOpen(false);
    }
  }, [propFormData, selectedEnvs, selectedProjects, getSelectedThresholdsCB]);

  const panelRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(panelRef, () => {
    if (formOpen) {
      resetForm();
    }
  });

  useEffect(() => {
    if (escapeKeyPressed) {
      if (formOpen) {
        resetForm();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escapeKeyPressed]);

  const resetForm = () => {
    setFormData({});
    setFormOpen(false);
    onClose?.();
  };

  const updateForm = (key, value) => {
    const data = {...formData};
    let selectedProject;
    let selectedEnvironment;
    if (key === 'project') {
      selectedProject = value;
      selectedEnvironment = formData.environment;
    } else if (key === 'environment') {
      selectedProject = formData.project;
      selectedEnvironment = value;
    }
    if (selectedProject) {
      const selectedThresholds = getSelectedThresholds(
        selectedProject,
        selectedEnvironment
      );
      const [unit, val] = selectedThresholds.length
        ? parseSeconds(selectedThresholds[0].window_in_seconds)
        : ['min', 0];
      data.windowVal = val;
      data.windowUnit = unit;
      data.thresholds = selectedThresholds;
    }
    data[key] = value;
    setFormData(data);
  };

  const projectSelectOptions: SelectValue<string>[] = useMemo(
    () =>
      selectedProjects.map(project => {
        return {
          value: project.id,
          textValue: project.slug,
          label: (
            <StyledIdBadge project={project} avatarSize={16} hideOverflow disableLink />
          ),
        };
      }),
    [selectedProjects]
  );

  // NOTE: only includes environments already attached to projects
  const envSelectOptions: SelectValue<string>[] = [
    {
      value: '',
      textValue: 'None',
      label: 'None',
    },
    ...allEnvs.map(env => {
      return {
        value: env,
        textValue: env,
        label: env,
      };
    }),
  ];

  return (
    <SlideOverPanel collapsed={!formOpen} ref={panelRef} onOpen={onOpen}>
      <FormSection>
        <Header>
          <div>Create New Threshold Group </div>
          <CloseButton
            priority="link"
            size="zero"
            borderless
            aria-label={t('Close Form')}
            icon={<IconClose size="sm" />}
            onClick={resetForm}
          />
        </Header>
      </FormSection>
      {formOpen && (
        <Fragment>
          <FormSection>
            <Title>Project & Environment Select</Title>
            <Fullrow>
              <StyledCompactSelect
                position="bottom-end"
                onChange={selectedOption => updateForm('project', selectedOption.value)}
                value={formData.project}
                options={projectSelectOptions}
                disabled={selectedProjects.length === 1}
              />
            </Fullrow>
            <Fullrow>
              <StyledCompactSelect
                position="bottom-end"
                onChange={selectedOption =>
                  updateForm('environment', selectedOption.value)
                }
                value={formData.environment}
                options={envSelectOptions}
              />
            </Fullrow>
            <div />
          </FormSection>
          <FormSection>
            <Title>Time Window</Title>
            <SplitRow>
              <StyledInput
                value={formData.windowVal}
                type="number"
                onChange={e => updateForm('windowVal', parseInt(e.target.value, 10))}
              />
              <StyledCompactSelect
                position="bottom-end"
                onChange={selectedOption =>
                  updateForm('windowUnit', selectedOption.value)
                }
                value={formData.windowUnit}
                defaultValue="min"
                options={[
                  {
                    value: 'sec',
                    textValue: 'seconds',
                    label: 'seconds',
                  },
                  {
                    value: 'min',
                    textValue: 'minutes',
                    label: 'minutes',
                  },
                  {
                    value: 'hrs',
                    textValue: 'hours',
                    label: 'hours',
                  },
                  {
                    value: 'days',
                    textValue: 'days',
                    label: 'days',
                  },
                ]}
              />
            </SplitRow>
          </FormSection>
          <FormSection>
            <Title>Set Threshold</Title>
            <StyledPanelTable isLoading={isLoading} headers={[]}>
              {formData.thresholds &&
                !!formData.thresholds.length &&
                formData.thresholds.map((threshold, idx) => (
                  <div key={`${threshold}-${idx}`}>
                    {threshold.threshold_type} : {threshold.value}
                  </div>
                ))}
              <div>Add new row</div>
            </StyledPanelTable>
          </FormSection>
        </Fragment>
      )}
    </SlideOverPanel>
  );
}

const CloseButton = styled(Button)`
  color: ${p => p.theme.gray300};
  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

const FormSection = styled('div')`
  padding: ${space(2)};
  display: flex;
  flex-direction: column;
`;

const Header = styled('div')`
  justify-content: space-between;
  display: flex;
  color: ${p => p.theme.subText};
`;

const Title = styled('div')`
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 600;
`;

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;
  > button {
    width: 100%;
  }
`;

const StyledInput = styled('input')`
  line-height: 1.4;
  font-size: ${p => p.theme.fontSizeMedium};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => 'solid ' + p.theme.border};
  padding: ${space(1)} ${space(2)};

  ::-webkit-outer-spin-button,
  ::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }
`;

const Fullrow = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  padding: ${space(1)} 0;
`;

const SplitRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: ${space(1)};
  padding: ${space(1)} 0;
`;

const StyledPanelTable = styled(PanelTable)`
  margin: ${space(1)} 0;
  > :last-child {
    border-bottom: none;
  }
`;
