import Web3 from 'web3';
import {Contract} from 'web3-eth-contract';
import * as fs from 'fs';
import * as path from 'path';
import ganache from 'ganache-core';

const BUILD_FILE_NAME = 'build.json';
const CONTRACT_FILE_NAME = 'contracts.json';

interface ContractBuild {
  abi: string
  bin: string
}

async function readFile<T>(file: string, def: T, fn: (data: string) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    fs.access(file, fs.constants.F_OK, (err) => {
      if (err) {
        resolve(def);
      } else {
        fs.readFile(file, 'utf8', (err, data) => {
          return err ? reject(err) : resolve(fn(data));
        });
      }
    });
  });
}

export async function writeFile<T>(file: string, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, data, (err) => {
      return err ? reject(err) : resolve();
    });
  });
}

function getBuildFile(network: string, file: string): string {
  return path.join(process.cwd(), '.build', network, file);
}

async function getContract(network: string, name: string): Promise<ContractBuild | null> {
  let contracts = await readFile(getBuildFile(network, BUILD_FILE_NAME), {}, JSON.parse);
  let contractsObject = contracts["contracts"] || {};

  let foundContract = Object.entries(contractsObject).find(([pathContractName, contract]) => {
    let [_, contractName] = pathContractName.split(":", 2);
    return contractName == name;
  });

  if (foundContract) {
    let [_, contractBuild] = foundContract;

    return <ContractBuild>contractBuild;
  } else {
    return null;
  }
}

export async function deployContract(web3: Web3, network: string, from: string, name: string, args: any[]): Promise<Contract> {
  let contractBuild = await getContract(network, name);
  if (!contractBuild) {
    throw new Error(`Cannot find contract \`${name}\` in build folder.`);
  }

  const contractAbi = JSON.parse(contractBuild.abi);
  const contract = new web3.eth.Contract(contractAbi);
  return await contract.deploy({data: '0x' + contractBuild.bin, arguments: args}).send({from: from, gas: 1000000});
}

export async function saveContract(name: string, contract: Contract, network: string): Promise<void> {
  let file = getBuildFile(network, CONTRACT_FILE_NAME);
  let curr = await readFile(file, {}, JSON.parse);
  curr[name] = contract.address;
  await writeFile(file, JSON.stringify(curr));
}
