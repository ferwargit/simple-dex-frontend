import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js";
import { CONFIG } from './config.js';

let provider, signer, address, simpleDexContract;
const simpleDexContractAddress = CONFIG.SIMPLE_DEX_CONTRACT_ADDRESS; // Dirección de tu contrato SimpleDEX
console.log("simpleDexContractAddress:", simpleDexContractAddress);
const simpleDexContractABI = CONFIG.SIMPLE_DEX_ABI;
console.log("simpleDexContractABI:", simpleDexContractABI);

async function updateBalance() {
    try {
        // Verificamos que tengamos el provider y la dirección
        if (!provider || !address) {
            console.error("updateBalance - No hay provider o address");
            return;
        }

        // Obtenemos el balance de la wallet
        const balance = await provider.getBalance(address);
        // Convertimos el balance a ETH
        const formattedBalance = ethers.formatEther(balance);
        // Actualizamos el balance en la UI
        document.getElementById("ethBalance").innerText = `Balance de la Wallet: ${formattedBalance} ETH`;

        console.log("updateBalance - Balance actualizado:", formattedBalance);
    } catch (error) {
        console.error("updateBalance - Error al actualizar el balance:", error);
    }
}

async function connectWallet() {
    // Estoy mostrando en la consola "Conectando a la wallet..." cuando se hace click en el botón para verificar la llamada a la función
    console.log("Conectando a la wallet...");

    if (window.ethereum) {
        // Estoy mostrando en la consola "Metamask detectado" cuando se detecta la wallet
        console.log("Metamask detectado");

        // Estoy obteniendo la cuenta de la wallet que se está conectando
        await window.ethereum.request({ method: "eth_requestAccounts" });
        // Estoy creando un nuevo proveedor para la wallet
        provider = new ethers.BrowserProvider(window.ethereum);
        // Hacemos un console.log del provider para ver las propiedades
        console.log("provider:", provider);
        // Estoy obteniendo el signer de la wallet
        signer = await provider.getSigner();
        // Hacemos un console.log del signer para ver las propiedades
        console.log("signer:", signer)
        // Estoy obteniendo la dirección de la wallet
        address = await signer.getAddress();
        // Hacemos un console.log de la dirección de la wallet
        console.log("connectWallet - address:", address);

        // Estoy ocultando el botón de conectar y mostrando el botón de desconectar
        document.getElementById("btnConnect").style.display = "none";
        document.getElementById("btnDisconnect").style.display = "block";

        // Estoy mostrando el estado de la wallet
        document.getElementById("status").innerText = `Estado: Conectado a la cuenta ${address}`;

        // Mostrar los balances cuando la wallet está conectada
        document.getElementById("ethBalance").style.display = "block";

        // Estoy mostrando los campos de agregar liquidez, intercambiar tokens, retirar liquidez y obtener precio
        document.getElementById("addLiquiditySection").style.display = "block";
        document.getElementById("swapTokensSection").style.display = "block";
        document.getElementById("removeLiquiditySection").style.display = "block";
        document.getElementById("getPriceSection").style.display = "block";

        //  Mostrar Reservas y Precios
        document.getElementById("reservesSection").style.display = "block";
        document.getElementById("exchangeRateSection").style.display = "block";

        // Actualizamos el balance de la wallet
        await updateBalance();
        // Actualizamos la reserva de la wallet
        await updateReserves();
        // Actualizamos 
        // await updateExchangeRate();

        // Estoy mostrando en la consola "Cuenta conectada" cuando se conecta la wallet
        console.log("connectWallet - Cuenta conectada");
    }
    else {
        // Estoy mostrando en la consola "Metamask no detectado" cuando no se detecta la wallet
        console.error("Metamask no detectado");
    }
}

async function disconnectWallet() {
    console.log("Desconectando la wallet...");

    // Limpiamos el estado de la aplicación
    provider = null;
    signer = null;
    address = null;

    // Estoy ocultando el botón de desconectar y mostrando el botón de conectar
    document.getElementById("btnDisconnect").style.display = "none";
    document.getElementById("btnConnect").style.display = "block";

    // Actualizamos el estado
    document.getElementById("status").innerText = "Estado: Desconectado";

    // Ocultar los balances cuando la wallet está desconectada
    document.getElementById("ethBalance").style.display = "none";

    // Ocultar los campos de agregar liquidez, intercambiar tokens, retirar liquidez y obtener precio
    document.getElementById("addLiquiditySection").style.display = "none";
    document.getElementById("swapTokensSection").style.display = "none";
    document.getElementById("removeLiquiditySection").style.display = "none";
    document.getElementById("getPriceSection").style.display = "none";


    document.getElementById("reservesSection").style.display = "none";
    // document.getElementById("exchangeRateSection").style.display = "none";

    console.log("disconnectWallet - Cuenta desconectada");
}

async function updateReserves() {
    try {
        if (!simpleDexContract) {
            simpleDexContract = new ethers.Contract(simpleDexContractAddress, simpleDexContractABI, provider);
        }

        // Leemos las reservas individualmente ya que son variables públicas
        const reserveA = await simpleDexContract.reserveA();
        const reserveB = await simpleDexContract.reserveB();

        document.getElementById("reserveA").innerText = `Reserva de Token A: ${ethers.formatUnits(reserveA, 18)}`;
        document.getElementById("reserveB").innerText = `Reserva de Token B: ${ethers.formatUnits(reserveB, 18)}`;

        console.log("updateReserves - Reservas actualizadas:", {
            reserveA: ethers.formatUnits(reserveA, 18),
            reserveB: ethers.formatUnits(reserveB, 18)
        });
    } catch (error) {
        console.error("updateReserves - Error al actualizar las reservas:", error);
    }
}

// async function updateExchangeRate() {
//     try {
//         if (!simpleDexContract) {
//             simpleDexContract = new ethers.Contract(simpleDexContractAddress, simpleDexContractABI, provider);
//         }

//         const reserves = await simpleDexContract.getReserves();
//         const exchangeRateAtoB = reserves[1] / reserves[0];
//         const exchangeRateBtoA = reserves[0] / reserves[1];
//         document.getElementById("exchangeRateAtoB").innerText = `1 Token A = ${exchangeRateAtoB.toFixed(4)} Token B`;
//         document.getElementById("exchangeRateBtoA").innerText = `1 Token B = ${exchangeRateBtoA.toFixed(4)} Token A`;

//         console.log("updateExchangeRate - Tasas de intercambio actualizadas:", exchangeRateAtoB, exchangeRateBtoA);
//     } catch (error) {
//         console.error("updateExchangeRate - Error al actualizar las tasas de intercambio:", error);
//     }
// }

// Estoy buscando el "btnConnect" y le estoy diciendo que cuando se haga click, se ejecute la función "connectWallet"
document.getElementById("btnConnect").addEventListener("click", connectWallet);
// Estoy buscando el "btnDisconnect" y le estoy diciendo que cuando se haga click, se ejecute la función "disconnectWallet"
document.getElementById("btnDisconnect").addEventListener("click", disconnectWallet);