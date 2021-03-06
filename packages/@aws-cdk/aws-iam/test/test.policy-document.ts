import { FnConcat, resolve } from '@aws-cdk/cdk';
import { Test } from 'nodeunit';
import { Anyone, AnyPrincipal, CanonicalUserPrincipal, PolicyDocument, PolicyPrincipal, PolicyStatement } from '../lib';
import { ArnPrincipal, CompositePrincipal, FederatedPrincipal, PrincipalPolicyFragment, ServicePrincipal } from '../lib';

export = {
  'the Permission class is a programming model for iam'(test: Test) {
    const p = new PolicyStatement();
    p.addAction('sqs:SendMessage');
    p.addActions('dynamodb:CreateTable', 'dynamodb:DeleteTable');
    p.addResource('myQueue');
    p.addResource('yourQueue');

    p.addAllResources();
    p.addAwsAccountPrincipal(new FnConcat('my', { account: 'account' }, 'name').toString());
    p.limitToAccount('12221121221');

    test.deepEqual(resolve(p), { Action:
      [ 'sqs:SendMessage',
        'dynamodb:CreateTable',
        'dynamodb:DeleteTable' ],
       Resource: [ 'myQueue', 'yourQueue', '*' ],
       Effect: 'Allow',
       Principal:
      { AWS:
         { 'Fn::Join':
          [ '',
          [ 'arn:',
            { Ref: 'AWS::Partition' },
            ':iam::my',
            { account: 'account' },
            'name:root' ] ] } },
       Condition: { StringEquals: { 'sts:ExternalId': '12221121221' } } });

    test.done();
  },

  'the PolicyDocument class is a dom for iam policy documents'(test: Test) {
    const doc = new PolicyDocument();
    const p1 = new PolicyStatement();
    p1.addAction('sqs:SendMessage');
    p1.addResource('*');

    const p2 = new PolicyStatement();
    p2.deny();
    p2.addActions('cloudformation:CreateStack');

    doc.addStatement(p1);
    doc.addStatement(p2);

    test.deepEqual(resolve(doc), {
      Version: '2012-10-17',
      Statement:
        [ { Effect: 'Allow', Action: 'sqs:SendMessage', Resource: '*' },
          { Effect: 'Deny', Action: 'cloudformation:CreateStack' } ] });

    test.done();
  },

  'A PolicyDocument can be initialized with an existing policy, which is merged upon serialization'(test: Test) {
    const base = {
      Version: 'Foo',
      Something: 123,
      Statement: [
        { Statement1: 1 },
        { Statement2: 2 }
      ]
    };
    const doc = new PolicyDocument(base);
    doc.addStatement(new PolicyStatement().addResource('resource').addAction('action'));

    test.deepEqual(resolve(doc), { Version: 'Foo',
    Something: 123,
    Statement:
     [ { Statement1: 1 },
       { Statement2: 2 },
       { Effect: 'Allow', Action: 'action', Resource: 'resource' } ] });
    test.done();
  },

  'Permission allows specifying multiple actions upon construction'(test: Test) {
    const perm = new PolicyStatement().addResource('MyResource').addActions('Action1', 'Action2', 'Action3');
    test.deepEqual(resolve(perm), {
      Effect: 'Allow',
      Action: [ 'Action1', 'Action2', 'Action3' ],
      Resource: 'MyResource' });
    test.done();
  },

  'PolicyDoc resolves to undefined if there are no permissions'(test: Test) {
    const p = new PolicyDocument();
    test.deepEqual(resolve(p), undefined);
    test.done();
  },

  'canonicalUserPrincipal adds a principal to a policy with the passed canonical user id'(test: Test) {
    const p = new PolicyStatement();
    const canoncialUser = "averysuperduperlongstringfor";
    p.addPrincipal(new CanonicalUserPrincipal(canoncialUser));
    test.deepEqual(resolve(p), {
      Effect: "Allow",
      Principal: {
        CanonicalUser: canoncialUser
      }
    });
    test.done();
  },

  'addAccountRootPrincipal adds a principal with the current account root'(test: Test) {
    const p = new PolicyStatement();
    p.addAccountRootPrincipal();
    test.deepEqual(resolve(p), {
      Effect: "Allow",
      Principal: {
        AWS: {
        "Fn::Join": [
          "",
          [
          "arn:",
          { Ref: "AWS::Partition" },
          ":iam::",
          { Ref: "AWS::AccountId" },
          ":root"
          ]
        ]
        }
      }
    });
    test.done();
  },

  'addFederatedPrincipal adds a Federated principal with the passed value'(test: Test) {
    const p = new PolicyStatement();
    p.addFederatedPrincipal("com.amazon.cognito", { StringEquals: { key: 'value' }});
    test.deepEqual(resolve(p), {
      Effect: "Allow",
      Principal: {
        Federated: "com.amazon.cognito"
      },
      Condition: {
        StringEquals: { key: 'value' }
      }
    });
    test.done();
  },

  'addAwsAccountPrincipal can be used multiple times'(test: Test) {
    const p = new PolicyStatement();
    p.addAwsAccountPrincipal('1234');
    p.addAwsAccountPrincipal('5678');
    test.deepEqual(resolve(p), {
      Effect: 'Allow',
      Principal: {
        AWS: [
          { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::1234:root']] },
          { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::5678:root']] }
        ]
      }
    });
    test.done();
  },

  'hasResource': {
    'false if there are no resources'(test: Test) {
      test.equal(new PolicyStatement().hasResource, false, 'hasResource should be false for an empty permission');
      test.done();
    },

    'true if there is one resource'(test: Test) {
      test.equal(
        new PolicyStatement().addResource('one-resource').hasResource,
        true,
        'hasResource is true when there is one resource');
      test.done();
    },

    'true for multiple resources'(test: Test) {
      const p = new PolicyStatement();
      p.addResource('r1');
      p.addResource('r2');
      test.equal(p.hasResource, true, 'hasResource is true when there are multiple resource');
      test.done();
    },
  },

  'hasPrincipal': {
    'false if there is no principal'(test: Test) {
      test.equal(new PolicyStatement().hasPrincipal, false);
      test.done();
    },

    'true if there is a principal'(test: Test) {
      const p = new PolicyStatement();
      p.addAwsPrincipal('bla');
      test.equal(p.hasPrincipal, true);
      test.done();
    }
  },

  'statementCount returns the number of statement in the policy document'(test: Test) {
    const p = new PolicyDocument();
    test.equal(p.statementCount, 0);
    p.addStatement(new PolicyStatement());
    test.equal(p.statementCount, 1);
    p.addStatement(new PolicyStatement());
    test.equal(p.statementCount, 2);
    test.done();
  },

  'the { AWS: "*" } principal is represented as `Anyone` or `AnyPrincipal`'(test: Test) {
    const p = new PolicyDocument();

    p.addStatement(new PolicyStatement().addPrincipal(new Anyone()));
    p.addStatement(new PolicyStatement().addPrincipal(new AnyPrincipal()));
    p.addStatement(new PolicyStatement().addAnyPrincipal());

    test.deepEqual(resolve(p), {
      Statement: [
        { Effect: 'Allow', Principal: '*' },
        { Effect: 'Allow', Principal: '*' },
        { Effect: 'Allow', Principal: '*' }
      ],
      Version: '2012-10-17'
    });
    test.done();
  },

  'addAwsPrincipal/addArnPrincipal are the aliases'(test: Test) {
    const p = new PolicyDocument();

    p.addStatement(new PolicyStatement().addAwsPrincipal('111222-A'));
    p.addStatement(new PolicyStatement().addArnPrincipal('111222-B'));
    p.addStatement(new PolicyStatement().addPrincipal(new ArnPrincipal('111222-C')));

    test.deepEqual(resolve(p), {
      Statement: [ {
        Effect: 'Allow', Principal: { AWS: '111222-A' } },
        { Effect: 'Allow', Principal: { AWS: '111222-B' } },
        { Effect: 'Allow', Principal: { AWS: '111222-C' } }
      ],
      Version: '2012-10-17'
    });

    test.done();
  },

  'addCanonicalUserPrincipal can be used to add cannonical user principals'(test: Test) {
    const p = new PolicyDocument();

    p.addStatement(new PolicyStatement().addCanonicalUserPrincipal('cannonical-user-1'));
    p.addStatement(new PolicyStatement().addPrincipal(new CanonicalUserPrincipal('cannonical-user-2')));

    test.deepEqual(resolve(p), {
      Statement: [
        { Effect: 'Allow', Principal: { CanonicalUser: 'cannonical-user-1' } },
        { Effect: 'Allow', Principal: { CanonicalUser: 'cannonical-user-2' } }
      ],
      Version: '2012-10-17'
    });

    test.done();
  },

  'addPrincipal correctly merges array in'(test: Test) {
    const arrayPrincipal: PolicyPrincipal = {
      assumeRoleAction: 'sts:AssumeRole',
      policyFragment: () => new PrincipalPolicyFragment({ AWS: ['foo', 'bar'] }),
    };
    const s = new PolicyStatement().addAccountRootPrincipal()
                                   .addPrincipal(arrayPrincipal);
    test.deepEqual(resolve(s), {
      Effect: 'Allow',
      Principal: {
        AWS: [
          { 'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::', { Ref: 'AWS::AccountId' }, ':root']] },
          'foo', 'bar'
        ]
      }
    });
    test.done();
  },

  // https://github.com/awslabs/aws-cdk/issues/1201
  'policy statements with multiple principal types can be created using multiple addPrincipal calls'(test: Test) {
    const s = new PolicyStatement()
      .addAwsPrincipal('349494949494')
      .addServicePrincipal('ec2.amazonaws.com')
      .addResource('resource')
      .addAction('action');

    test.deepEqual(resolve(s), {
      Action: 'action',
      Effect: 'Allow',
      Principal: { AWS: '349494949494', Service: 'ec2.amazonaws.com' },
      Resource: 'resource'
    });

    test.done();
  },

  'CompositePrincipal can be used to represent a principal that has multiple types': {

    'with a single principal'(test: Test) {
      const p = new CompositePrincipal(new ArnPrincipal('i:am:an:arn'));
      const statement = new PolicyStatement().addPrincipal(p);
      test.deepEqual(resolve(statement), { Effect: 'Allow', Principal: { AWS: 'i:am:an:arn' } });
      test.done();
    },

    'conditions are not allowed on individual principals of a composite'(test: Test) {
      const p = new CompositePrincipal(new ArnPrincipal('i:am'));
      test.throws(() => p.addPrincipals(new FederatedPrincipal('federated', { condition: 1 })),
        /Components of a CompositePrincipal must not have conditions/);

      test.done();
    },

    'principals and conditions are a big nice merge'(test: Test) {
      // add via ctor
      const p = new CompositePrincipal(
        new ArnPrincipal('i:am:an:arn'),
        new ServicePrincipal('amazon.com'));

      // add via `addPrincipals` (with condition)
      p.addPrincipals(
        new Anyone(),
        new ServicePrincipal('another.service')
      );

      const statement = new PolicyStatement().addPrincipal(p);

      // add via policy statement
      statement.addAwsPrincipal('aws-principal-3');
      statement.addCondition('cond2', { boom: 123 });

      test.deepEqual(resolve(statement), {
        Condition: {
          cond2: { boom: 123 }
        },
        Effect: 'Allow',
        Principal: {
          AWS: [ 'i:am:an:arn', '*', 'aws-principal-3' ],
          Service: [ 'amazon.com', 'another.service' ],
        }
      });
      test.done();
    },

    'cannot mix types of assumeRoleAction in a single composite'(test: Test) {
      // GIVEN
      const p = new CompositePrincipal(new ArnPrincipal('arn')); // assumeRoleAction is "sts:AssumeRule"

      // THEN
      test.throws(() => p.addPrincipals(new FederatedPrincipal('fed', {}, 'sts:Boom')),
        /Cannot add multiple principals with different "assumeRoleAction". Expecting "sts:AssumeRole", got "sts:Boom"/);

      test.done();
    }
  },
};
