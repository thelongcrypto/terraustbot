# To log all the bugs and errors while developing and how it was solved for learning and sharing purpose

data: {
    code: 3,
    message: 'failed to execute message; message index: 0: Error parsing into type cw20_legacy::msg::ExecuteMsg: unknown variant `swap`, expected one of `transfer`, `burn`, `send`, `mint`, `increase_allowance`, `decrease_allowance`, `transfer_from`, `send_from`, `burn_from`: execute wasm contract failed: invalid request',
    details: []
} => wrong contract address

data: {
    code: 3,
    message: 'failed to execute message; message index: 0: Error parsing into type terraswap::pair::ExecuteMsg: Invalid type: execute wasm contract failed: invalid request',
    details: []
} => amount in MsgExecuteContract should be string instead of number

data: {
    code: 2,
    message: 'rpc error: code = Internal desc = Error parsing into type cw20_legacy::msg::QueryMsg: unknown variant `simulation`, expected one of `balance`, `token_info`, `minter`, `allowance`, `all_allowances`, `all_accounts`: contract query failed: unknown request',
    details: []
}

https://docs.terra.money/docs/develop/dapp/smart-contracts/manage-cw20-tokens.html

