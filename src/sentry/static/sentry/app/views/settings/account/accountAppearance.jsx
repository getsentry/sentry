import {Box} from 'grid-emotion';
import React from 'react';

import AsyncView from '../../asyncView';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';
import formData from '../../../data/forms/accountAppearance';

const ENDPOINT = '/users/me/appearance/';

class AccountAppearance extends AsyncView {
  getEndpoints() {
    return [['appearance', ENDPOINT]];
  }

  renderBody() {
    return (
      <div>
        <Form
          apiMethod="PUT"
          apiEndpoint={ENDPOINT}
          saveOnBlur
          allowUndo
          initialData={this.state.appearance}
        >
          <Box>
            <JsonForm location={this.props.location} forms={formData} />
          </Box>
        </Form>
      </div>
    );
  }
}

export default AccountAppearance;
