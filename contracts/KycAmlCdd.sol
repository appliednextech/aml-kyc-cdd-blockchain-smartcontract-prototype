/**
 * Retail AML/KYC/CDD Prototype Contract (Permissionless demo on Sepolia)
 * - Stores customer profile data and enforces EDD rules for high-risk customers.
 * - High Risk criteria: PEP == true OR expectedMonthlyUsd > 10,000
 * - For High Risk: requires all EDD checklist items == true.
 *
 * UPDATED UNIQUENESS RULE (as requested):
 * - Customer is considered "already registered" if:
 *      fullName AND identificationNumber are the same,
 *   even if customerId is different.
 *
 * NOTE: This is a demo contract. In real systems, sensitive documents should be off-chain.
 */
pragma solidity ^0.8.20;

contract KycAmlCdd {
    struct CustomerInput {
        string customerId;
        string fullName;              // expected to be normalized (trimmed + lowercased) by frontend
        string homeAddress;
        string identificationNumber;  // passport/emirates id/etc.
        string occupation;
        bool isPep;
        uint256 expectedMonthlyUsd;
        string expectedActivity;
        bytes32 photoHash;            // hash of the customer photo file
    }

    struct EddInput {
        bool sourceOfIncomeCollected;
        bool siteVisitCompleted;
        bool familyAndAssociatesScreened;
    }

    struct CustomerRecord {
        // identity & profile
        string customerId;
        string fullName;
        string homeAddress;
        string identificationNumber;
        string occupation;

        // risk inputs
        bool isPep;
        uint256 expectedMonthlyUsd;
        string expectedActivity;

        // document proof
        bytes32 photoHash;

        // derived flags
        bool highRisk;
        EddInput edd;

        // audit
        address registeredBy;
        uint256 registeredAt;
    }

    // Keyed by (fullName + identificationNumber)
    mapping(bytes32 => bool) private _registered;
    mapping(bytes32 => CustomerRecord) private _records;

    event CustomerRegistered(
        bytes32 indexed customerKey,
        string customerId,
        string fullName,
        string identificationNumber,
        bool highRisk
    );

    // Uniqueness key: fullName + identificationNumber
    function _key(string memory fullName, string memory identificationNumber) internal pure returns (bytes32) {
        // Frontend should normalize fullName (trim + lowercase) for consistent hashing.
        // identificationNumber should also be trimmed/normalized where possible.
        return keccak256(abi.encodePacked(fullName, "|", identificationNumber));
    }

    // Check if customer exists using (fullName + identificationNumber)
    function isRegistered(string memory fullName, string memory identificationNumber) external view returns (bool) {
        return _registered[_key(fullName, identificationNumber)];
    }

    // Fetch record using (fullName + identificationNumber)
    function getRecord(string memory fullName, string memory identificationNumber)
        external
        view
        returns (CustomerRecord memory)
    {
        bytes32 k = _key(fullName, identificationNumber);
        require(_registered[k], "Customer not found");
        return _records[k];
    }

    function registerCustomer(CustomerInput calldata c, EddInput calldata e) external {
        // Uniqueness based on fullName + identificationNumber (customerId can differ)
        bytes32 k = _key(c.fullName, c.identificationNumber);
        require(!_registered[k], "Customer already registered");

        bool highRisk = c.isPep || (c.expectedMonthlyUsd > 10000);

        if (highRisk) {
            require(e.sourceOfIncomeCollected, "EDD required: source of income evidence");
            require(e.siteVisitCompleted, "EDD required: site visit evidence");
            require(e.familyAndAssociatesScreened, "EDD required: family/associates screening");
        }

        _registered[k] = true;

        CustomerRecord storage r = _records[k];
        r.customerId = c.customerId;
        r.fullName = c.fullName;
        r.homeAddress = c.homeAddress;
        r.identificationNumber = c.identificationNumber;
        r.occupation = c.occupation;

        r.isPep = c.isPep;
        r.expectedMonthlyUsd = c.expectedMonthlyUsd;
        r.expectedActivity = c.expectedActivity;

        r.photoHash = c.photoHash;

        r.highRisk = highRisk;
        r.edd = e;

        r.registeredBy = msg.sender;
        r.registeredAt = block.timestamp;

        emit CustomerRegistered(k, c.customerId, c.fullName, c.identificationNumber, highRisk);
    }
}
