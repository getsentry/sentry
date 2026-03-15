import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';
import {EditableIssueViewHeader} from 'sentry/views/issueList/editableIssueViewHeader';
import type {GroupSearchView} from 'sentry/views/issueList/types';

export default Storybook.story('EditableIssueViewHeader', story => {
  story('Default View', () => {
    const mockView: GroupSearchView = {
      id: '1',
      name: 'My Custom View',
      query: 'is:unresolved',
      querySort: 'date',
      projects: [],
      environments: [],
      timeFilters: {},
      createdBy: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
      },
      dateCreated: '2024-01-01T00:00:00Z',
      dateUpdated: '2024-01-01T00:00:00Z',
    };

    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="EditableIssueViewHeader" /> component allows users
          to edit issue view names inline with explicit Save and Cancel buttons.
        </p>
        <p>
          <strong>Features:</strong>
        </p>
        <ul>
          <li>Click the edit icon or double-click the title to enter edit mode</li>
          <li>Save and Cancel buttons appear below the input field</li>
          <li>Save button shows loading state during API request</li>
          <li>Toast notification appears after successful save</li>
          <li>Keyboard shortcuts: Enter to save, Escape to cancel</li>
        </ul>
        <div style={{padding: '20px', background: '#f5f5f5', borderRadius: '4px'}}>
          <EditableIssueViewHeader view={mockView} />
        </div>
        <p style={{marginTop: '20px'}}>
          <strong>Instructions:</strong>
        </p>
        <ol>
          <li>Click the edit icon (appears on hover) or double-click the title</li>
          <li>Modify the text in the input field</li>
          <li>Click the "Save" button or press Enter</li>
          <li>Observe the loading state on the Save button</li>
          <li>A toast notification will appear after the save completes</li>
          <li>Try clicking "Cancel" or pressing Escape to exit without saving</li>
        </ol>
      </Fragment>
    );
  });

  story('Edit Mode', () => {
    const mockView: GroupSearchView = {
      id: '2',
      name: 'Production Errors',
      query: 'is:unresolved environment:production',
      querySort: 'freq',
      projects: [],
      environments: ['production'],
      timeFilters: {},
      createdBy: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
      },
      dateCreated: '2024-01-01T00:00:00Z',
      dateUpdated: '2024-01-01T00:00:00Z',
    };

    return (
      <Fragment>
        <p>This story demonstrates the edit mode with Save and Cancel buttons visible.</p>
        <div style={{padding: '20px', background: '#f5f5f5', borderRadius: '4px'}}>
          <EditableIssueViewHeader view={mockView} />
        </div>
        <p style={{marginTop: '20px'}}>
          <em>
            Note: Click the edit icon to see the Save and Cancel buttons. The Save button
            will show a loading spinner when clicked.
          </em>
        </p>
      </Fragment>
    );
  });

  story('Long View Name', () => {
    const mockView: GroupSearchView = {
      id: '3',
      name: 'This is a very long view name that demonstrates how the component handles text overflow and wrapping in the edit mode',
      query: 'is:unresolved',
      querySort: 'date',
      projects: [],
      environments: [],
      timeFilters: {},
      createdBy: {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
      },
      dateCreated: '2024-01-01T00:00:00Z',
      dateUpdated: '2024-01-01T00:00:00Z',
    };

    return (
      <Fragment>
        <p>Testing with a long view name to ensure proper text handling.</p>
        <div style={{padding: '20px', background: '#f5f5f5', borderRadius: '4px'}}>
          <EditableIssueViewHeader view={mockView} />
        </div>
      </Fragment>
    );
  });
});
