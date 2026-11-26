import {renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openModal} from '@sentry/scraps/modal';

import {EditAdminOptionModal} from 'admin/components/editAdminOptionModal';
import type {SerializedOption} from 'admin/views/options';

describe('EditAdminOptionModal', () => {
  it('shows every option in the group in order with its value', () => {
    const group = {name: 'sampling'};
    const options: SerializedOption[] = [
      {
        name: 'sampling.rate',
        fieldType: 'rate',
        value: 0.25,
        groupingInfo: {...group, order: 1},
      },
      {
        name: 'sampling.enabled',
        fieldType: 'bool',
        value: true,
        groupingInfo: {...group, order: 0},
      },
      {name: 'unrelated', fieldType: 'bool', value: false},
    ];

    openModal(deps => (
      <EditAdminOptionModal
        {...deps}
        option={options[0]!}
        allOptions={options}
        path="/_admin/options/"
      />
    ));
    renderGlobalModal();

    const terms = screen.getAllByRole('term').map(term => term.textContent);
    expect(terms).toEqual(['sampling.enabled', 'sampling.rate']);
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('0.25')).toBeInTheDocument();
    expect(screen.queryByText('unrelated')).not.toBeInTheDocument();
  });
});
