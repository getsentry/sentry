import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {RequestState} from 'sentry/types';
import {importProfile, ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {makeSentrySampledProfile} from 'sentry/utils/profiling/profile/sentrySampledProfile.specutil';

import * as profileGroupProviderMod from '../../profileGroupProvider';

import {ProfileDetailsTable} from './profileDetailsTable';

const {routerContext} = initializeOrg();

jest.mock('../../profileGroupProvider', () => {
  return {
    useProfileGroup: jest.fn(),
  };
});

const useProfileGroupSpy = jest.spyOn(profileGroupProviderMod, 'useProfileGroup');

const mockUseProfileData: RequestState<ProfileGroup> = {
  type: 'resolved',
  data: importProfile(makeSentrySampledProfile(), ''),
};
useProfileGroupSpy.mockImplementation(() => [mockUseProfileData, () => {}]);

function assertTableHeaders(headerText: string[]) {
  const gridHeadRow = screen.getByTestId('grid-head-row');
  headerText.forEach(txt => {
    expect(within(gridHeadRow).getByText(txt)).toBeInTheDocument();
  });
}

async function selectView(selection: string) {
  const dropdownSelect = screen.getByText('View');
  userEvent.click(dropdownSelect);
  // attempt to select option from the select option list
  // not what is being shown as active selection
  const option = await screen.findAllByText(selection);
  userEvent.click(option[1] ?? option[0]);
}

describe('profileDetailsTable', () => {
  it.each([
    {
      view: 'Slowest Functions',
      tableHeaders: [
        'Symbol',
        'Package',
        'File',
        'Thread',
        'Type',
        'Self Weight',
        'Total Weight',
      ],
    },
    {
      view: 'Group by Symbol',
      tableHeaders: ['Symbol', 'Type', 'Package', 'P75(Self)', 'P95(Self)', 'Count'],
    },
    {
      view: 'Group by Package',
      tableHeaders: ['Package', 'Type', 'P75(Self)', 'P95(Self)', 'Count'],
    },
    {
      view: 'Group by File',
      tableHeaders: ['File', 'Type', 'P75(Self)', 'P95(Self)', 'Count'],
    },
  ])('renders the "$view" view', async ({view, tableHeaders}) => {
    render(<ProfileDetailsTable />, {
      context: routerContext,
    });

    await selectView(view);

    expect(screen.getByTestId('grid-editable')).toBeInTheDocument();
    expect(screen.getByText(view)).toBeInTheDocument();
    assertTableHeaders(tableHeaders);
  });
});
