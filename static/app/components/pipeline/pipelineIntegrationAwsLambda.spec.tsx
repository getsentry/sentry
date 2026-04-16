import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ProjectsStore} from 'sentry/stores/projectsStore';

Object.defineProperty(globalThis.crypto, 'randomUUID', {
  value: () => 'mock-uuid-1234',
});

import {awsLambdaIntegrationPipeline} from './pipelineIntegrationAwsLambda';
import type {PipelineStepProps} from './types';

const ProjectSelectStep = awsLambdaIntegrationPipeline.steps[0].component;
const CloudFormationStep = awsLambdaIntegrationPipeline.steps[1].component;
const InstrumentationStep = awsLambdaIntegrationPipeline.steps[2].component;

function makeStepProps<D, A>(
  overrides: Partial<PipelineStepProps<D, A>> & {stepData: D}
): PipelineStepProps<D, A> {
  return {
    advance: jest.fn(),
    advanceError: null,
    isAdvancing: false,
    stepIndex: 0,
    totalSteps: 3,
    ...overrides,
  };
}

describe('ProjectSelectStep', () => {
  it('renders project selector', () => {
    const projects = [
      ProjectFixture({id: '1', slug: 'project-b'}),
      ProjectFixture({id: '2', slug: 'project-a'}),
    ];
    ProjectsStore.loadInitialData(projects);

    render(<ProjectSelectStep {...makeStepProps({stepData: {}})} />);

    expect(
      screen.getByText(
        'Select a Sentry project to associate with your AWS Lambda functions.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toBeInTheDocument();
  });

  it('auto-selects single project and calls advance when submitted', async () => {
    const advance = jest.fn();
    const projects = [ProjectFixture({id: '42', slug: 'my-project'})];
    ProjectsStore.loadInitialData(projects);

    render(<ProjectSelectStep {...makeStepProps({stepData: {}, advance})} />);

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({projectId: 42});
    });
  });

  it('shows submitting state when isAdvancing', () => {
    ProjectsStore.loadInitialData([ProjectFixture()]);

    render(<ProjectSelectStep {...makeStepProps({stepData: {}, isAdvancing: true})} />);

    expect(screen.getByRole('button', {name: 'Submitting...'})).toBeDisabled();
  });
});

describe('CloudFormationStep', () => {
  const stepData = {
    baseCloudformationUrl:
      'https://console.aws.amazon.com/cloudformation/home#/stacks/create/review',
    templateUrl: 'https://example.com/template.json',
    stackName: 'Sentry-Monitoring-Stack',
    regionList: ['us-east-1', 'us-east-2', 'eu-west-1'],
  };

  it('renders CloudFormation link and form fields', () => {
    render(<CloudFormationStep {...makeStepProps({stepData})} />);

    expect(screen.getByText("Add Sentry's CloudFormation Stack")).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: "Add Sentry's CloudFormation stack"})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'AWS Account Number'})).toBeInTheDocument();
  });

  it('calls advance with account_number and region', async () => {
    const advance = jest.fn();
    render(<CloudFormationStep {...makeStepProps({stepData, advance})} />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'AWS Account Number'}),
      '599817902985'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'AWS Region'}),
      'us-east-2'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        accountNumber: '599817902985',
        region: 'us-east-2',
        awsExternalId: 'mock-uuid-1234',
      });
    });
  });

  it('reveals external ID field when clicking existing stack button', async () => {
    render(<CloudFormationStep {...makeStepProps({stepData})} />);

    expect(screen.queryByRole('textbox', {name: 'External ID'})).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {name: 'Using an existing CloudFormation stack?'})
    );

    expect(screen.getByRole('textbox', {name: 'External ID'})).toBeInTheDocument();
    expect(screen.getByDisplayValue('mock-uuid-1234')).toBeInTheDocument();
  });

  it('includes modified aws_external_id in advance', async () => {
    const advance = jest.fn();
    render(<CloudFormationStep {...makeStepProps({stepData, advance})} />);

    await userEvent.click(
      screen.getByRole('button', {name: 'Using an existing CloudFormation stack?'})
    );

    const externalIdInput = screen.getByRole('textbox', {name: 'External ID'});
    await userEvent.clear(externalIdInput);
    await userEvent.type(externalIdInput, 'custom-external-id');

    await userEvent.type(
      screen.getByRole('textbox', {name: 'AWS Account Number'}),
      '599817902985'
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'AWS Region'}),
      'us-east-2'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        accountNumber: '599817902985',
        region: 'us-east-2',
        awsExternalId: 'custom-external-id',
      });
    });
  });

  it('shows verifying state when isAdvancing', () => {
    render(<CloudFormationStep {...makeStepProps({stepData, isAdvancing: true})} />);

    expect(screen.getByRole('button', {name: 'Verifying...'})).toBeDisabled();
  });
});

describe('InstrumentationStep', () => {
  const functions = [
    {name: 'lambdaA', runtime: 'nodejs12.x', description: 'Function A'},
    {name: 'lambdaB', runtime: 'python3.9', description: 'Function B'},
  ];

  it('renders function list with all enabled by default', () => {
    render(<InstrumentationStep {...makeStepProps({stepData: {functions}})} />);

    expect(screen.getByText('lambdaA')).toBeInTheDocument();
    expect(screen.getByText('lambdaB')).toBeInTheDocument();
    expect(screen.getByText('nodejs12.x')).toBeInTheDocument();
    expect(screen.getByText('python3.9')).toBeInTheDocument();
  });

  it('calls advance with enabled function names', async () => {
    const advance = jest.fn();
    render(<InstrumentationStep {...makeStepProps({stepData: {functions}, advance})} />);

    await userEvent.click(screen.getByRole('button', {name: 'Instrument Functions'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        enabledFunctions: ['lambdaA', 'lambdaB'],
      });
    });
  });

  it('can toggle individual functions off', async () => {
    const advance = jest.fn();
    render(<InstrumentationStep {...makeStepProps({stepData: {functions}, advance})} />);

    const switches = screen.getAllByRole('checkbox');
    await userEvent.click(switches[1]!);

    await userEvent.click(screen.getByRole('button', {name: 'Instrument Functions'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        enabledFunctions: ['lambdaA'],
      });
    });
  });

  it('disables submit when no functions are enabled', async () => {
    render(<InstrumentationStep {...makeStepProps({stepData: {functions}})} />);

    const switches = screen.getAllByRole('checkbox');
    await userEvent.click(switches[0]!);
    await userEvent.click(switches[1]!);

    expect(screen.getByRole('button', {name: 'Instrument Functions'})).toBeDisabled();
  });

  it('shows success and failure tags after instrumentation', () => {
    render(
      <InstrumentationStep
        {...makeStepProps({
          stepData: {
            functions,
            successCount: 1,
            failures: [{name: 'lambdaA', error: 'Invalid layer'}],
          },
        })}
      />
    );

    expect(screen.getByText('1 function OK')).toBeInTheDocument();
    expect(screen.getByText('1 function failed')).toBeInTheDocument();
    expect(screen.getByText('Invalid layer')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Troubleshooting Docs'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/#troubleshooting'
    );
  });

  it('shows only failure tag when all functions fail', () => {
    render(
      <InstrumentationStep
        {...makeStepProps({
          stepData: {
            functions,
            successCount: 0,
            failures: [
              {name: 'lambdaA', error: 'Invalid layer'},
              {name: 'lambdaB', error: 'Timeout'},
            ],
          },
        })}
      />
    );

    expect(screen.queryByText(/function OK/)).not.toBeInTheDocument();
    expect(screen.getByText('2 functions failed')).toBeInTheDocument();
  });

  it('does not show result tags before instrumentation attempt', () => {
    render(<InstrumentationStep {...makeStepProps({stepData: {functions}})} />);

    expect(screen.queryByText(/function OK/)).not.toBeInTheDocument();
    expect(screen.queryByText(/function failed/)).not.toBeInTheDocument();
  });

  it('calls advance with enabledFunctions on retry after failures', async () => {
    const advance = jest.fn();
    render(
      <InstrumentationStep
        {...makeStepProps({
          stepData: {
            functions,
            successCount: 0,
            failures: [{name: 'lambdaA', error: 'Error'}],
          },
          advance,
        })}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Instrument Functions'}));

    await waitFor(() => {
      expect(advance).toHaveBeenCalledWith({
        enabledFunctions: ['lambdaA', 'lambdaB'],
      });
    });
  });
});
