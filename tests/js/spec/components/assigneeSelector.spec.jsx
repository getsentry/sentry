import AssigneeSelector from 'app/components/assigneeSelector';

describe('AssigneeSelector', function() {
  describe('statics', function () {
    const USER_1 = {
      name: 'Jane Doe',
      email: 'janedoe@example.com'
    };
    const USER_2 = {
      name: 'John Smith',
      email: 'johnsmith@example.com'
    };

    const filterMembers = AssigneeSelector.filterMembers;

    describe('filterMembers()', function () {
      it('should return the full array when filter is falsy', function () {
        expect(filterMembers([USER_1, USER_2], '')).to.eql([USER_1, USER_2]);
        expect(filterMembers([USER_1, USER_2], null)).to.eql([USER_1, USER_2]);
        expect(filterMembers([USER_1, USER_2], undefined)).to.eql([USER_1, USER_2]);
      });

      it('should match on email', function () {
        expect(filterMembers([USER_1, USER_2], 'johnsmith@example.com')).to.eql([USER_2]);
      });

      it('should match on name', function () {
        expect(filterMembers([USER_1, USER_2], 'John Smith')).to.eql([USER_2]);
      });

      it('should ignore capitalization', function () {
        expect(filterMembers([USER_1], 'Jane')).to.eql([USER_1]);
        expect(filterMembers([USER_1], 'jane')).to.eql([USER_1]);
      });
    });
  });
});

