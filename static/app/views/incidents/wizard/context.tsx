import {createContext, useContext} from 'react';

import {IconChat, IconFix, IconLightning, IconRuler, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ComponentStep} from 'sentry/views/incidents/wizard/componentStep';
import {DemoStep} from 'sentry/views/incidents/wizard/demoStep';
import {SmokeyStep} from 'sentry/views/incidents/wizard/smokeyStep';
import {TemplateStep} from 'sentry/views/incidents/wizard/templateStep';
import {ToolStep} from 'sentry/views/incidents/wizard/toolStep';

export enum IncidentSetupStep {
  TOOLS = 'tools',
  COMPONENTS = 'components',
  TEMPLATE = 'template',
  SMOKEY = 'smokey',
  DEMO = 'demo',
}

export interface SetupStep {
  content: React.ComponentType<any>;
  description: string;
  icon: React.ComponentType<any>;
  title: string;
}

export const INCIDENT_STEP_ORDER: IncidentSetupStep[] = [
  IncidentSetupStep.TOOLS,
  IncidentSetupStep.COMPONENTS,
  IncidentSetupStep.TEMPLATE,
  IncidentSetupStep.SMOKEY,
  IncidentSetupStep.DEMO,
];

export const INCIDENT_SETUP_STEPS: Record<IncidentSetupStep, SetupStep> = {
  [IncidentSetupStep.TOOLS]: {
    title: t('Connect Your Tools'),
    description: t(
      'Integrate your whole workflow now so you can focus on fighting fires later.'
    ),
    icon: IconSettings,
    content: ToolStep,
  },
  [IncidentSetupStep.COMPONENTS]: {
    title: t('Add Components'),
    description: t(
      'What are the key parts of your appplication or services that can break?'
    ),
    icon: IconFix,
    content: ComponentStep,
  },
  [IncidentSetupStep.TEMPLATE]: {
    title: t('Setup a Template'),
    description: t('The small things make all the difference'),
    icon: IconRuler,
    content: TemplateStep,
  },
  [IncidentSetupStep.SMOKEY]: {
    title: t('Meet Smokey'),
    description: t('Say hello to our interactive agent for incident management'),
    icon: IconChat,
    content: SmokeyStep,
  },
  [IncidentSetupStep.DEMO]: {
    title: t('Test It Out'),
    description: t('Create a demo incident to verify your setup'),
    icon: IconLightning,
    content: DemoStep,
  },
};

export interface IncidentSetupContext {
  [IncidentSetupStep.TOOLS]: {
    complete: boolean;
    channel_config?: Record<string, any>;
    channel_provider?: string;
    retro_config?: Record<string, any>;
    retro_provider?: string;
    schedule_config?: Record<string, any>;
    schedule_provider?: string;
    status_page_config?: Record<string, any>;
    status_page_provider?: string;
    task_config?: Record<string, any>;
    task_provider?: string;
  };
  [IncidentSetupStep.COMPONENTS]: {
    complete: boolean;
  };
  [IncidentSetupStep.TEMPLATE]: {
    complete: boolean;
    case_handle?: string;
    lead_title?: string;
    severity_handle?: string;
    update_frequency?: string;
  };
  [IncidentSetupStep.SMOKEY]: {
    complete: boolean;
  };
  [IncidentSetupStep.DEMO]: {
    complete: boolean;
  };
  setStepContext: (
    step: IncidentSetupStep,
    config: IncidentSetupContext[IncidentSetupStep]
  ) => void;
}

export const IncidentSetupContext = createContext<IncidentSetupContext | null>(null);

export function useIncidentSetupContext() {
  const ctx = useContext(IncidentSetupContext);
  if (!ctx) {
    throw new Error(
      'useIncidentSetupContext must be used within an IncidentSetupContext.Provider'
    );
  }
  return ctx;
}
