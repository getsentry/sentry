import {ErrorDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TextField from 'sentry/components/forms/fields/textField';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useSetAutomaticName} from 'sentry/views/detectors/components/forms/common/useSetAutomaticName';
import {DetectorFormProvider} from 'sentry/views/detectors/components/forms/context';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';

// Test component that uses the hook
function TestDetectorForm() {
  useSetAutomaticName(form => {
    const testField = form.getValue('testField');
    if (typeof testField !== 'string' || !testField) {
      return null;
    }
    return `Monitor for ${testField}`;
  });

  return (
    <div>
      <TextField name="testField" label="Test Field" />
    </div>
  );
}

describe('useSetAutomaticName', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  const renderDetectorForm = (detector?: Detector, initialFormData = {}) => {
    return render(
      <DetectorFormProvider detectorType="error" project={project} detector={detector}>
        <NewDetectorLayout
          detectorType="error"
          formDataToEndpointPayload={data => data as any}
          initialFormData={initialFormData}
        >
          <TestDetectorForm />
        </NewDetectorLayout>
      </DetectorFormProvider>,
      {organization}
    );
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  it('automatically generates and updates name from field value', async () => {
    renderDetectorForm();

    await screen.findByText('New Monitor');

    const testField = screen.getByRole('textbox', {name: 'Test Field'});

    // Type first value
    await userEvent.type(testField, 'service-1');
    await screen.findByText('Monitor for service-1');

    // Change the value
    await userEvent.clear(testField);
    await userEvent.type(testField, 'service-2');
    await screen.findByText('Monitor for service-2');
  });

  it('stops auto-generating after user manually edits name', async () => {
    renderDetectorForm();

    await screen.findByText('New Monitor');

    // Type into test field - name should auto-generate
    const testField = screen.getByRole('textbox', {name: 'Test Field'});
    await userEvent.type(testField, 'my-service');

    const nameField = await screen.findByText('Monitor for my-service');

    // Manually edit the name
    await userEvent.click(nameField);
    const nameInput = screen.getByRole('textbox', {name: 'Monitor Name'});
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Custom Monitor Name{Enter}');

    await screen.findByText('Custom Monitor Name');

    // Change test field - name should NOT update
    await userEvent.clear(testField);
    await userEvent.type(testField, 'different-service');

    // Verify name didn't change
    expect(screen.getByText('Custom Monitor Name')).toBeInTheDocument();
    expect(screen.queryByText('Monitor for different-service')).not.toBeInTheDocument();
  });

  it('does not auto-generate name when editing existing detector', async () => {
    const detector = ErrorDetectorFixture({
      name: 'Existing Monitor',
      projectId: project.id,
    });

    renderDetectorForm(detector, {name: detector.name});

    await screen.findByText(detector.name);

    // Type into test field - name should NOT auto-generate
    const testField = screen.getByRole('textbox', {name: 'Test Field'});
    await userEvent.type(testField, 'my-service');

    // Verify name didn't change
    expect(screen.getByText(detector.name)).toBeInTheDocument();
    expect(screen.queryByText('Monitor for my-service')).not.toBeInTheDocument();
  });
});
