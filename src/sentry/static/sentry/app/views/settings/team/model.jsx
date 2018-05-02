import {updateTeam} from '../../../actionCreators/teams';
import FormModel from '../components/forms/model';

class TeamFormModel extends FormModel {
  doApiRequest({data}) {
    return new Promise((resolve, reject) =>
      updateTeam(
        this.api,
        {
          orgId: this.orgId,
          teamId: this.teamId,
          data,
        },
        {
          success: resolve,
          error: reject,
        }
      )
    );
  }
}

export default TeamFormModel;
