import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js";
import { CONFIG } from './config.js';

let provider, signer, address, simpleDexContract;

// Variable global para almacenar los detalles de la última transacción de liquidez
let lastLiquidityAddTransactionDetails = null;
// Variable global para almacenar los detalles de la última transacción de retiro de liquidez
let lastLiquidityRemovalTransactionDetails = null;

// Variable global para almacenar los detalles de la última transacción de intercambio de Token A por Token B
let lastSwapAforBTransactionDetails = null;
// Variable global para almacenar los detalles de la última transacción de intercambio de Token B por Token A
let lastSwapBforATransactionDetails = null;

const simpleDexContractAddress = CONFIG.SIMPLE_DEX_CONTRACT_ADDRESS; // Dirección de tu contrato SimpleDEX
console.log("simpleDexContractAddress:", simpleDexContractAddress);
const simpleDexContractABI = CONFIG.SIMPLE_DEX_ABI;
console.log("simpleDexContractABI:", simpleDexContractABI);

// ABI global para tokens ERC20
let ERC20_ABI = null;

/**
 * Carga de forma asíncrona los archivos ABI (Interfaz Binaria de Aplicación) de los contratos.
 * 
 * @async
 * @function loadABI
 * @param {string} contractName - Nombre del contrato cuyo ABI se desea cargar.
 * 
 * @description
 * Recupera el archivo ABI de un contrato específico desde un directorio de recursos.
 * Utiliza la función fetch para cargar el archivo JSON que contiene la definición del contrato.
 * 
 * @returns {Promise<Object[]>} Arreglo de definiciones de interfaz del contrato.
 * 
 * @throws {Error}
 * - Si no se puede encontrar el archivo ABI
 * - Si hay problemas para parsear el JSON del ABI
 * - Si la ruta del archivo es inválida
 * 
 * @example
 * // Cargar el ABI del contrato SimpleDex
 * const simpleDexABI = await loadABI('SimpleDex');
 */
async function loadABI() {
    try {
        const response = await fetch('https://gist.githubusercontent.com/veox/8800debbf56e24718f9f483e1e40c35c/raw/f853187315486225002ba56e5283c1dba0556e6f/erc20.abi.json');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const abi = await response.json();

        // Verificaciones adicionales
        if (!abi || !Array.isArray(abi)) {
            throw new Error("ABI inválido o vacío");
        }

        // Asignamos globalmente y registramos
        ERC20_ABI = abi;
        console.log("ABI cargado exitosamente:", abi.length, "métodos");

        return abi;
    } catch (error) {
        console.error("Error al cargar ABI:", error);
        ERC20_ABI = null; // Aseguramos que sea null en caso de error
        throw error; // Re-lanzamos para que el llamador pueda manejar el error
    }
}


/**
 * Actualiza los saldos de los tokens A y B para la cuenta de usuario conectada.
 * 
 * @async
 * @function updateTokenBalances
 * @description
 * Consulta los saldos de los tokens A y B en la billetera del usuario.
 * Utiliza las instancias de los contratos de tokens y actualiza los elementos 
 * de la interfaz de usuario con los saldos actualizados.
 * 
 * @returns {Promise<void>}
 * 
 * @throws {Error}
 * - Si los contratos de tokens no están inicializados
 * - Si no hay una cuenta de usuario conectada
 * - Si hay problemas para recuperar los saldos de los tokens
 * 
 * @example
 * // Actualizar saldos de tokens para la cuenta conectada
 * await updateTokenBalances();
 */
async function updateTokenBalances() {
    try {
        // Verificamos que tengamos una wallet conectada y el contrato SimpleDex inicializado
        if (!address || !simpleDexContract) {
            console.error("No hay wallet conectada o contrato inicializado");
            return;
        }

        // Cargamos el ABI si no está disponible
        if (!ERC20_ABI) {
            await loadABI();
        }

        // Obtenemos las direcciones de los tokens desde el contrato SimpleDex
        const tokenAAddress = await simpleDexContract.tokenA();
        const tokenBAddress = await simpleDexContract.tokenB();

        // Verificamos que el ABI esté cargado
        if (!ERC20_ABI) {
            throw new Error("No se pudo cargar el ABI de ERC20");
        }

        // Creamos instancias de los contratos de tokens
        const tokenAContract = new ethers.Contract(tokenAAddress, ERC20_ABI, signer);
        const tokenBContract = new ethers.Contract(tokenBAddress, ERC20_ABI, signer);

        // Obtenemos los balances de los tokens
        const balanceA = await tokenAContract.balanceOf(address);
        const balanceB = await tokenBContract.balanceOf(address);

        // Obtenemos los símbolos y decimales de los tokens
        const symbolA = await tokenAContract.symbol();
        const symbolB = await tokenBContract.symbol();
        const decimalsA = await tokenAContract.decimals();
        const decimalsB = await tokenBContract.decimals();

        // Formateamos los balances
        const formattedBalanceA = ethers.formatUnits(balanceA, decimalsA);
        const formattedBalanceB = ethers.formatUnits(balanceB, decimalsB);

        // Actualizamos la interfaz de usuario
        document.getElementById("tokenABalance").textContent = `${symbolA} Balance: ${formattedBalanceA}`;
        document.getElementById("tokenBBalance").textContent = `${symbolB} Balance: ${formattedBalanceB}`;

        console.log(`Balances de tokens - ${symbolA}: ${formattedBalanceA}, ${symbolB}: ${formattedBalanceB}`);
    } catch (error) {
        console.error("Error al obtener balances de tokens:", error);

        // Reseteamos los elementos de la interfaz en caso de error
        document.getElementById("tokenABalance").textContent = "Token A Balance: Error";
        document.getElementById("tokenBBalance").textContent = "Token B Balance: Error";
    }
}


/**
 * Actualiza el saldo de un token específico para la cuenta de usuario conectada.
 * 
 * @async
 * @function updateBalance
 * @param {string} tokenAddress - Dirección del contrato del token.
 * @param {string} elementId - Identificador del elemento HTML donde se mostrará el saldo.
 * 
 * @description
 * Consulta el saldo de un token específico en la billetera del usuario.
 * Utiliza la instancia del contrato de token para obtener el saldo y 
 * actualiza el elemento de interfaz de usuario con el valor recuperado.
 * 
 * @returns {Promise<string>} Saldo del token como cadena de texto.
 * 
 * @throws {Error}
 * - Si el contrato del token no está inicializado
 * - Si no hay una cuenta de usuario conectada
 * - Si hay problemas para recuperar el saldo del token
 * 
 * @example
 * // Actualizar saldo de Token A
 * const tokenABalance = await updateBalance(tokenAAddress, 'tokenABalanceElement');
 */
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
        document.getElementById("ethBalance").textContent = `${formattedBalance} ETH`;

        console.log("updateBalance - Balance actualizado:", formattedBalance);
    } catch (error) {
        console.error("updateBalance - Error al actualizar el balance:", error);
    }
}


/**
 * Conecta la billetera del usuario al sitio web utilizando MetaMask.
 * 
 * @async
 * @function connectWallet
 * @description
 * Gestiona la conexión de la billetera Ethereum del usuario a través de MetaMask.
 * Solicita permiso para conectar, cambia a la red correcta si es necesario,
 * y actualiza la interfaz con la información de la cuenta conectada.
 * 
 * @returns {Promise<string|null>} Dirección de la cuenta conectada o null si falla
 * 
 * @throws {Error}
 * - Si MetaMask no está instalado
 * - Si el usuario rechaza la conexión
 * - Si hay problemas para cambiar de red
 * 
 * @example
 * // Conectar billetera del usuario
 * const accountAddress = await connectWallet();
 * if (accountAddress) {
 *   console.log('Wallet conectada:', accountAddress);
 * }
 */
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
        // document.getElementById("status").textContent = `Conectado a la cuenta ${address}`;

        // Actualizar estado de conexión
        document.getElementById("status").textContent = "Conectado";
        // Mostrar detalles de la cuenta
        document.getElementById("connectedAccount").textContent = address;
        // Mostrar sección de detalles de cuenta
        document.getElementById("accountDetails").style.display = "block";

        // Obtener y mostrar la red
        try {
            const network = await provider.getNetwork();
            const chainId = Number(network.chainId);

            const networkMap = {
                1: "Ethereum Mainnet",
                3: "Ropsten",
                4: "Rinkeby",
                42: "Kovan",
                56: "Binance Smart Chain",
                97: "Binance Smart Chain Testnet",
                137: "Polygon Mainnet",
                80001: "Mumbai",
                42161: "Arbitrum One",
                421611: "Arbitrum Goerli",
                10: "Optimism",
                420: "Optimism Goerli",
                42170: "Avalanche",
                43113: "Avalanche Fuji",
                43114: "Avalanche Mainnet",
                11155111: "Sepolia",
                534351: "Scroll Sepolia",
                // Agrega más redes aquí...
            };

            const networkName = networkMap[chainId] || `Red ${chainId}`;

            console.log(`Red detectada: ${networkName} ID: ${chainId}`);

            document.getElementById("connectedNetwork").textContent = networkName;

            console.log("Red detectada:", networkName, "ID:", chainId);
        } catch (error) {
            console.error("Error al obtener la red:", error);
            document.getElementById("connectedNetwork").textContent = "Red No Detectada";
        }


        // Mostrar los balances cuando la wallet está conectada
        document.getElementById("ethBalanceSection").style.display = "block";
        // Mostrar balance de tokens
        document.getElementById("tokenBalancesSection").style.display = "block";

        // Estoy mostrando los campos de agregar liquidez, intercambiar tokens, retirar liquidez y obtener precio
        document.getElementById("addLiquiditySection").style.display = "block";
        document.getElementById("swapTokensSection").style.display = "block";
        document.getElementById("removeLiquiditySection").style.display = "block";
        document.getElementById("getPriceSection").style.display = "block";

        //  Mostrar Reservas y Precios
        document.getElementById("reservesSection").style.display = "block";
        document.getElementById("exchangeRateSection").style.display = "block";

        // Inicializamos el contrato SimpleDex
        await initializeSimpleDexContract();

        // Mostrar Direcciones de Tokens
        document.getElementById("tokensAddressSection").style.display = "block";
        document.getElementById("tokenAAddress").textContent = await simpleDexContract.tokenA();
        document.getElementById("tokenBAddress").textContent = await simpleDexContract.tokenB();

        // Actualizamos el balance de la wallet
        await updateBalance();
        // Actualizamos los balances de los tokens
        await updateTokenBalances();
        // Actualizamos la reserva de la wallet
        await updateReserves();
        // Actualizamos 
        await updateExchangeRate();

        // Estoy mostrando en la consola "Cuenta conectada" cuando se conecta la wallet
        console.log("connectWallet - Cuenta conectada");
    }
    else {
        // Estoy mostrando en la consola "Metamask no detectado" cuando no se detecta la wallet
        console.error("Metamask no detectado");
    }
}


/**
 * Inicializa el contrato SimpleDex utilizando ethers.js.
 * 
 * @async
 * @function initializeSimpleDexContract
 * @description
 * Configura la instancia del contrato SimpleDex utilizando la dirección del contrato
 * y su ABI (Interfaz Binaria de Aplicación). Establece la conexión con la red Ethereum
 * a través del proveedor de MetaMask.
 * 
 * @returns {Promise<void>}
 * 
 * @throws {Error}
 * - Si no hay proveedor de MetaMask disponible
 * - Si la dirección del contrato SimpleDex es inválida
 * - Si hay problemas para crear la instancia del contrato
 * 
 * @example
 * // Inicializar contrato SimpleDex antes de realizar operaciones
 * await initializeSimpleDexContract();
 */
async function initializeSimpleDexContract() {
    try {
        // Verificamos que tengamos el signer antes de inicializar el contrato
        if (!signer) {
            console.error("initializeSimpleDexContract - No hay signer disponible");
            return null;
        }

        // Cargamos el ABI del IERC20 si aun no esta cargado
        if (!ERC20_ABI) {
            console.log("Intentando cargar ABI en initializeSimpleDexContract...");
            try {
                await loadABI();
            } catch (loadError) {
                console.error("Error al cargar ABI en initializeSimpleDexContract:", loadError);
                return null;
            }
        }

        // Creamos la instancia del contrato usando ethers.js
        simpleDexContract = new ethers.Contract(
            simpleDexContractAddress,
            simpleDexContractABI,
            signer
        );

        console.log("SimpleDex Contract inicializado:", simpleDexContract);
        return simpleDexContract;
    } catch (error) {
        console.error("Error al inicializar el contrato SimpleDex:", error);
        return null;
    }
}


/**
 * Desconecta la billetera del usuario del sitio web.
 * 
 * @function disconnectWallet
 * @description
 * Limpia la información de la cuenta conectada, actualiza la interfaz de usuario
 * y restablece los estados relacionados con la conexión de la billetera.
 * 
 * @returns {void}
 * 
 * @example
 * // Desconectar la billetera actual
 * disconnectWallet();
 */
async function disconnectWallet() {
    console.log("Desconectando la wallet...");

    // Limpiamos el estado de la aplicación
    provider = null;
    signer = null;
    address = null;
    simpleDexContract = null;

    // Estoy ocultando el botón de desconectar y mostrando el botón de conectar
    document.getElementById("btnDisconnect").style.display = "none";
    document.getElementById("btnConnect").style.display = "block";

    // Ocultar los detalles de la cuenta
    document.getElementById("accountDetails").style.display = "none";
    // Limpiar valores
    document.getElementById("connectedAccount").textContent = "-";
    document.getElementById("connectedNetwork").textContent = "-";

    // Actualizamos el estado
    document.getElementById("status").textContent = "Desconectado";

    // Ocultar los balances cuando la wallet está desconectada
    document.getElementById("ethBalanceSection").style.display = "none";
    // Ocultar balance de tokens
    document.getElementById("tokenBalancesSection").style.display = "none";

    document.getElementById("reservesSection").style.display = "none";
    document.getElementById("exchangeRateSection").style.display = "none";
    document.getElementById("tokensAddressSection").style.display = "none";

    // Ocultar los campos de agregar liquidez, intercambiar tokens, retirar liquidez y obtener precio
    document.getElementById("addLiquiditySection").style.display = "none";
    document.getElementById("swapTokensSection").style.display = "none";
    document.getElementById("removeLiquiditySection").style.display = "none";
    document.getElementById("getPriceSection").style.display = "none";

    console.log("disconnectWallet - Cuenta desconectada");
}


/**
 * Actualiza las reservas de tokens A y B en el pool de liquidez.
 * 
 * @async
 * @function updateReserves
 * @description
 * Consulta el contrato SimpleDex para obtener las cantidades actuales 
 * de reservas de Token A y Token B en el pool de liquidez.
 * Actualiza los elementos de la interfaz de usuario con los valores recuperados.
 * 
 * @returns {Promise<void>}
 * 
 * @throws {Error}
 * - Si el contrato SimpleDex no está inicializado
 * - Si hay problemas para recuperar las reservas de tokens
 * - Si los elementos de la interfaz de usuario no existen
 * 
 * @example
 * // Actualizar las reservas de tokens en el pool de liquidez
 * await updateReserves();
 */
async function updateReserves() {
    try {
        if (!simpleDexContract) {
            simpleDexContract = new ethers.Contract(simpleDexContractAddress, simpleDexContractABI, provider);
        }

        // Leemos las reservas individualmente ya que son variables públicas
        const reserveA = await simpleDexContract.reserveA();
        const reserveB = await simpleDexContract.reserveB();

        document.getElementById("reserveA").innerText = `${ethers.formatUnits(reserveA, 18)}`;
        document.getElementById("reserveB").innerText = `${ethers.formatUnits(reserveB, 18)}`;

        console.log("updateReserves - Reservas actualizadas:", {
            reserveA: ethers.formatUnits(reserveA, 18),
            reserveB: ethers.formatUnits(reserveB, 18)
        });
    } catch (error) {
        console.error("updateReserves - Error al actualizar las reservas:", error);
    }
}


/**
 * Actualiza la tasa de cambio entre los tokens A y B en el pool de liquidez.
 * 
 * @async
 * @function updateExchangeRate
 * @description
 * Consulta el contrato SimpleDex para obtener la tasa de cambio actual
 * entre Token A y Token B. Calcula y actualiza los elementos de la interfaz 
 * de usuario con la información de la tasa de intercambio.
 * 
 * @returns {Promise<void>}
 * 
 * @throws {Error}
 * - Si el contrato SimpleDex no está inicializado
 * - Si hay problemas para recuperar la tasa de cambio
 * - Si los elementos de la interfaz de usuario no existen
 * 
 * @example
 * // Actualizar la tasa de cambio entre tokens
 * await updateExchangeRate();
 */
async function updateExchangeRate() {
    try {
        // Verificar y reinicializar el contrato si es necesario
        if (!simpleDexContract) {
            simpleDexContract = new ethers.Contract(
                simpleDexContractAddress,
                simpleDexContractABI,
                provider
            );
        }

        // Obtener reservas de forma segura con Promise.all
        const [reserveA, reserveB] = await Promise.all([
            simpleDexContract.reserveA(),
            simpleDexContract.reserveB()
        ]);

        // Conversión segura a números, manejando casos de reservas cero
        const reserveANum = parseFloat(reserveA.toString());
        const reserveBNum = parseFloat(reserveB.toString());

        // Calcular tasas de intercambio con manejo de división por cero
        let exchangeRateAtoB = "0.000000";
        let exchangeRateBtoA = "0.000000";

        if (reserveANum > 0 && reserveBNum > 0) {
            exchangeRateAtoB = (reserveBNum / reserveANum).toFixed(6);
            exchangeRateBtoA = (reserveANum / reserveBNum).toFixed(6);
        }

        // Actualizar elementos de la interfaz
        const exchangeRateAtoBElement = document.getElementById("exchangeRateAtoB");
        const exchangeRateBtoAElement = document.getElementById("exchangeRateBtoA");

        if (exchangeRateAtoBElement && exchangeRateBtoAElement) {
            exchangeRateAtoBElement.innerText = `1 Token A = ${exchangeRateAtoB} Token B`;
            exchangeRateBtoAElement.innerText = `1 Token B = ${exchangeRateBtoA} Token A`;
        } else {
            console.warn("updateExchangeRate - Elementos de tasa de intercambio no encontrados");
        }

        // Logging detallado
        console.log("updateExchangeRate - Tasas de intercambio actualizadas:", {
            reserveA: reserveANum,
            reserveB: reserveBNum,
            exchangeRateAtoB,
            exchangeRateBtoA
        });

    } catch (error) {
        // Manejo de errores detallado
        console.error("updateExchangeRate - Error al actualizar las tasas de intercambio:", {
            message: error.message,
            name: error.name,
            stack: error.stack
        });

        // Opcional: Mostrar mensaje de error en la interfaz
        const exchangeRateAtoBElement = document.getElementById("exchangeRateAtoB");
        const exchangeRateBtoAElement = document.getElementById("exchangeRateBtoA");

        if (exchangeRateAtoBElement && exchangeRateBtoAElement) {
            exchangeRateAtoBElement.innerText = "Error al obtener tasa";
            exchangeRateBtoAElement.innerText = "Error al obtener tasa";
        }
    }
}


window.copyToClipboard = function (elementId) {
    const element = document.getElementById(elementId);
    navigator.clipboard.writeText(element.textContent).then(() => {
        const tooltip = element.nextElementSibling;
        if (tooltip) {
            tooltip.textContent = '¡Copiado!';
            tooltip.classList.remove('hidden');
            setTimeout(() => {
                tooltip.textContent = 'Copiar';
                tooltip.classList.add('hidden');
            }, 1500);
        }
    });
}


/**
 * Obtiene el precio de un token específico desde el contrato SimpleDex.
 * 
 * @async
 * @function getTokenPrice
 * @param {string} tokenAddress - Dirección del token del cual se desea obtener el precio.
 * 
 * @description
 * Consulta el contrato SimpleDex para recuperar el precio actual de un token.
 * Utiliza la dirección del token como parámetro para realizar la consulta.
 * 
 * @returns {Promise<string>} Precio del token como una cadena de texto.
 * 
 * @throws {Error}
 * - Si el contrato SimpleDex no está inicializado
 * - Si la dirección del token es inválida
 * - Si hay problemas para recuperar el precio del token
 * 
 * @example
 * // Obtener el precio de un token específico
 * const tokenAPrice = await getTokenPrice(tokenAAddress);
 * console.log('Precio de Token A:', tokenAPrice);
 */
async function getTokenPrice() {
    try {
        // Verificamos que el contrato SimpleDex esté inicializado
        if (!simpleDexContract) {
            console.error("El contrato SimpleDex no está inicializado");
            return;
        }

        // Obtenemos la dirección del token desde el input
        const tokenAddressInput = document.getElementById("tokenAddress");
        const tokenAddress = tokenAddressInput.value.trim();

        // Validamos que se haya ingresado una dirección
        if (!tokenAddress) {
            mostrarMensajeError("Por favor ingrese una dirección de token");
            console.error("Por favor ingrese una dirección de token");
            return;
        }

        // Validar formato de dirección Ethereum usando ethers.js
        try {
            const addressChecksum = ethers.getAddress(tokenAddress);

            // Llamamos a la función getPrice del contrato
            const price = await simpleDexContract.getPrice(addressChecksum);

            // Formateamos el precio (asumiendo 18 decimales)
            const formattedPrice = ethers.formatUnits(price, 18);

            // Mostrar el precio en la interfaz
            document.getElementById("tokenPrice").textContent = `Precio: ${formattedPrice}`;

            // Limpiar cualquier mensaje de error previo
            limpiarMensajeError();

        } catch (addressError) {
            // Manejar errores de formato de dirección
            mostrarMensajeError("Dirección de token inválida");
            document.getElementById("tokenPrice").textContent = "-";
        }

    } catch (error) {
        console.error("Error al obtener el precio del token:", error);
        mostrarMensajeError("Error al obtener el precio del token");
        document.getElementById("tokenPrice").textContent = "-";
    }
}


/**
 * Muestra un mensaje de error genérico en la interfaz de usuario.
 * 
 * @function mostrarMensajeError
 * @param {string} mensaje - Texto descriptivo del error ocurrido.
 * 
 * @description
 * Crea y muestra un mensaje de error en un elemento de la interfaz.
 * El mensaje se estiliza con colores de error y se puede eliminar 
 * automáticamente después de un tiempo configurable.
 * 
 * @returns {void}
 * 
 * @example
 * // Mostrar un mensaje de error genérico
 * mostrarMensajeError('Ha ocurrido un error inesperado');
 * 
 * // Mostrar un mensaje de error específico
 * mostrarMensajeError('Error al conectar la billetera');
 */
function mostrarMensajeError(mensaje) {
    // Crear o encontrar un elemento para mostrar errores
    let errorElement = document.getElementById('tokenAddressError');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'tokenAddressError';
        errorElement.className = 'text-red-500 text-sm mt-2';
        document.querySelector('#tokenAddress').parentNode.appendChild(errorElement);
    }
    errorElement.textContent = mensaje;
}


/**
 * Elimina los mensajes de error mostrados en la interfaz de usuario.
 * 
 * @function limpiarMensajeError
 * @description
 * Busca y elimina los elementos de error existentes en la interfaz.
 * Útil para limpiar mensajes de error después de que se ha resuelto un problema
 * o cuando se interactúa con un campo de entrada.
 * 
 * @returns {void}
 * 
 * @example
 * // Limpiar todos los mensajes de error
 * limpiarMensajeError();
 */
function limpiarMensajeError() {
    const errorElement = document.getElementById('tokenAddressError');
    if (errorElement) {
        errorElement.textContent = '';
    }
}


// Agregar un event listener para validar en tiempo real
document.getElementById('tokenAddress').addEventListener('input', function () {
    const tokenAddress = this.value.trim();

    // Validación en tiempo real
    if (tokenAddress) {
        try {
            ethers.getAddress(tokenAddress);
            limpiarMensajeError();
        } catch (error) {
            mostrarMensajeError("Formato de dirección inválido");
        }
    } else {
        limpiarMensajeError();
    }
});


/**
 * Limpia los valores de precio mostrados para los tokens A y B.
 * 
 * @function clearTokenPrice
 * @description
 * Restablece los elementos de la interfaz que muestran los precios 
 * de los tokens A y B a un estado vacío o predeterminado.
 * Útil para limpiar información de precios antes de una nueva consulta 
 * o cuando se desconecta la billetera.
 * 
 * @returns {void}
 * 
 * @example
 * // Limpiar los precios de los tokens
 * clearTokenPrice();
 */
function clearTokenPrice() {
    // Limpiar input de dirección
    const tokenAddressInput = document.getElementById("tokenAddress");
    if (tokenAddressInput) {
        tokenAddressInput.value = "";
    }

    // Restablecer precio del token
    const tokenPriceElement = document.getElementById("tokenPrice");
    if (tokenPriceElement) {
        tokenPriceElement.textContent = "-";
    }

    limpiarMensajeError();

    console.log("Precio del token y dirección limpiados");
}


/**
 * Realiza un intercambio de tokens, convirtiendo un monto de Token A a Token B.
 * 
 * @async
 * @function swapTokenAforB
 * @description
 * Ejecuta una transacción de intercambio de Token A por Token B en el contrato SimpleDex.
 * Valida el saldo, aprueba tokens, y gestiona la transacción con manejo de errores.
 * 
 * @returns {Promise<void>}
 * 
 * @throws {Error} 
 * - Si el contrato SimpleDex no está inicializado
 * - Si la cantidad de Token A es inválida
 * - Si hay saldo insuficiente
 * - Si la transacción de intercambio falla
 * 
 * @example
 * // Ejecutar intercambio de Token A por Token B
 * await swapTokenAforB();
 */
async function swapTokenAforB() {

    try {
        // Verificamos que el contrato SimpleDex esté inicializado
        if (!simpleDexContract) {
            console.error("El contrato SimpleDex no está inicializado");
            return;
        }

        // Obtener la cantidad de Token A a intercambiar
        const amountAInput = document.getElementById("amountAIn");
        const amountAIn = amountAInput.value.trim();

        // Validaciones
        if (!amountAIn || isNaN(amountAIn) || Number(amountAIn) <= 0) {
            console.error("Cantidad de Token A inválida");
            mostrarMensajeErrorSwap("Cantidad de Token A inválida", "amountAIn");
            return;
        }

        let toast;
        // Mostrar toast de transacción en progreso
        toast = showTransactionToast("Procesando intercambio de Token A por Token B...", "swap");

        // Convertir a unidades del contrato (asumiendo 18 decimales)
        const amountAInWei = ethers.parseUnits(amountAIn, 18);

        // Obtener direcciones de tokens
        const tokenAAddress = await simpleDexContract.tokenA();
        const tokenBAddress = await simpleDexContract.tokenB();

        // Crear contratos de tokens
        const tokenAContract = new ethers.Contract(tokenAAddress, ERC20_ABI, signer);
        const tokenBContract = new ethers.Contract(tokenBAddress, ERC20_ABI, signer);

        // Verificar saldo de Token B
        const balanceA = await tokenAContract.balanceOf(await signer.getAddress());

        // Verificar si hay suficiente saldo
        if (amountAInWei > balanceA) {
            throw new Error("Saldo insuficiente de Token A");
        }

        // Aprobar tokens antes del intercambio
        const approveTokenATx = await tokenAContract.approve(simpleDexContractAddress, amountAInWei);
        await approveTokenATx.wait();

        // Logging adicional para depuración
        console.log("Parámetros de intercambio:", {
            amountAIn,
            amountAInWei: amountAInWei.toString(),
            balanceA: balanceA.toString()
        });

        // Llamar a la función de intercambio del contrato
        const tx = await simpleDexContract.swapAforB(amountAInWei);

        // Esperar confirmación de la transacción
        const receipt = await tx.wait();

        // Validación adicional de la transacción
        if (!receipt || !receipt.status) {
            throw new Error("La transacción de intercambio no se completó correctamente");
        }

        // Mostrar detalles de la transacción de intercambio
        showSwapAforBTransactionDetails(receipt, amountAIn);

        // Eliminar toast de transacción
        removeTransactionToast();

        console.log("Intercambio de Token A a Token B exitoso:", receipt);

        // Limpiar input
        amountAInput.value = "";

        // Actualizar balances y tasas de intercambio 
        await Promise.all([
            updateExchangeRate(),
            updateTokenBalances(),
            updateReserves()
        ]);

    } catch (error) {
        console.error("Error en el intercambio de Token A por Token B:", error);

        // Mostrar detalles específicos del error
        console.log("Error details:", {
            message: error.message,
            code: error.code,
            reason: error.reason,
            data: error.data
        });

        // Eliminar toast de transacción
        removeTransactionToast();

        // Mostrar toast de error
        showTransactionToast("Error en el intercambio de Token A por Token B", 'error');

        // Manejo de errores específicos
        if (error.code === "ACTION_REJECTED") {
            console.log("Transacción cancelada por el usuario");
        }
    }
}


/**
 * Realiza un intercambio de tokens, convirtiendo un monto de Token B a Token A.
 * 
 * @async
 * @function swapTokenBforA
 * @description
 * Ejecuta una transacción de intercambio de Token B por Token A en el contrato SimpleDex.
 * Valida el saldo, aprueba tokens, y gestiona la transacción con manejo de errores.
 * 
 * @returns {Promise<void>}
 * 
 * @throws {Error} 
 * - Si el contrato SimpleDex no está inicializado
 * - Si la cantidad de Token B es inválida
 * - Si hay saldo insuficiente
 * - Si la transacción de intercambio falla
 * 
 * @example
 * // Ejecutar intercambio de Token B por Token A
 * await swapTokenBforA();
 */
async function swapTokenBforA() {
    try {
        // Verificamos que el contrato SimpleDex esté inicializado
        if (!simpleDexContract) {
            console.error("El contrato SimpleDex no está inicializado");
            return;
        }

        // Obtener la cantidad de Token B a intercambiar
        const amountBInput = document.getElementById("amountBIn");
        const amountBIn = amountBInput.value.trim();

        // Validaciones
        if (!amountBIn || isNaN(amountBIn) || Number(amountBIn) <= 0) {
            console.error("Cantidad de Token B inválida");
            mostrarMensajeErrorSwap("Cantidad de Token B inválida", "amountBIn");
            return;
        }

        let toast;
        // Mostrar toast de transacción en progreso
        toast = showTransactionToast("Procesando intercambio de Token B por Token A...", "swap");

        // Convertir a unidades del contrato (asumiendo 18 decimales)
        const amountBInWei = ethers.parseUnits(amountBIn, 18);

        // Obtener direcciones de tokens
        const tokenAAddress = await simpleDexContract.tokenA();
        const tokenBAddress = await simpleDexContract.tokenB();

        // Crear contratos de tokens
        const tokenAContract = new ethers.Contract(tokenAAddress, ERC20_ABI, signer);
        const tokenBContract = new ethers.Contract(tokenBAddress, ERC20_ABI, signer);

        // Verificar saldo de Token B
        const balanceB = await tokenBContract.balanceOf(await signer.getAddress());

        // Verificar si hay suficiente saldo
        if (amountBInWei > balanceB) {
            throw new Error("Saldo insuficiente de Token B");
        }

        // Aprobar tokens antes del intercambio
        const approveTokenBTx = await tokenBContract.approve(simpleDexContractAddress, amountBInWei);
        await approveTokenBTx.wait();

        // Logging adicional para depuración
        console.log("Parámetros de intercambio:", {
            amountBIn,
            amountBInWei: amountBInWei.toString(),
            balanceB: balanceB.toString()
        });

        // Llamar a la función de intercambio del contrato
        const tx = await simpleDexContract.swapBforA(amountBInWei);

        // Esperar confirmación de la transacción
        const receipt = await tx.wait();

        // Validación adicional de la transacción
        if (!receipt || !receipt.status) {
            throw new Error("La transacción de intercambio no se completó correctamente");
        }

        // Mostrar detalles de la transacción de intercambio
        showSwapBforATransactionDetails(receipt, amountBIn);

        // Eliminar toast de transacción al completarse
        removeTransactionToast();

        console.log("Intercambio de Token B a Token A exitoso:", receipt);

        // Limpiar input
        amountBInput.value = "";

        // Actualizar balances y tasas de intercambio 
        await Promise.all([
            updateExchangeRate(),
            updateTokenBalances(),
            updateReserves()
        ]);

    } catch (error) {
        console.error("Error en el intercambio de Token B por Token A:", error);

        // Mostrar detalles específicos del error
        console.log("Error details:", {
            message: error.message,
            code: error.code,
            reason: error.reason,
            data: error.data
        });

        // Eliminar toast de transacción
        removeTransactionToast();

        // Mostrar toast de error con mensaje específico
        showTransactionToast(`Error en el intercambio: ${error.message}`, 'error');

        // Manejo de errores específicos
        if (error.code === "ACTION_REJECTED") {
            console.log("Transacción cancelada por el usuario");
        }
    }
}


/**
 * Alterna la visibilidad de las animaciones en la interfaz de usuario.
 * 
 * @function toggleAnimations
 * @description
 * Activa o desactiva las animaciones de los elementos de la interfaz.
 * Permite al usuario habilitar o deshabilitar efectos visuales dinámicos.
 * Modifica las clases CSS para mostrar u ocultar animaciones.
 * 
 * @param {boolean} [forceState] - Estado opcional para forzar las animaciones.
 * @returns {void}
 * 
 * @example
 * // Alternar animaciones
 * toggleAnimations();
 * 
 * // Forzar activación de animaciones
 * toggleAnimations(true);
 * 
 * // Forzar desactivación de animaciones
 * toggleAnimations(false);
 */
function toggleAnimations() {
    const animationsContainer = document.getElementById('animationsContainer');
    const walletConnected = document.getElementById('walletStatusSection').classList.contains('wallet-connected');

    if (animationsContainer && walletConnected) {
        animationsContainer.style.display = 'none';
    } else if (animationsContainer) {
        animationsContainer.style.display = 'block';
    }
}


/**
 * Agrega liquidez al pool de intercambio con dos tipos de tokens.
 * 
 * @async
 * @function addLiquidity
 * @description
 * Permite al usuario agregar liquidez al contrato SimpleDex proporcionando 
 * cantidades de Token A y Token B. Realiza validaciones de entrada, 
 * aprueba tokens y ejecuta la transacción de adición de liquidez.
 * 
 * @returns {Promise<void>}
 * 
 * @throws {Error}
 * - Si el contrato SimpleDex no está inicializado
 * - Si las cantidades de tokens son inválidas
 * - Si hay saldo insuficiente
 * - Si la transacción de adición de liquidez falla
 * 
 * @example
 * // Agregar liquidez con cantidades específicas de Token A y Token B
 * await addLiquidity();
 */
async function addLiquidity() {
    try {
        // Validar que la wallet esté conectada
        if (!signer) {
            console.error("Por favor, conecta tu wallet primero");
            mostrarMensajeErrorLiquidity(['amountA', 'amountB']);
            return;
        }

        // Obtener valores de los inputs
        const amountA = document.getElementById('amountA').value.trim();
        const amountB = document.getElementById('amountB').value.trim();

        // Validaciones individuales para cada token
        const errores = [];
        if (!amountA || isNaN(amountA) || Number(amountA) <= 0) {
            errores.push('amountA');
        }
        if (!amountB || isNaN(amountB) || Number(amountB) <= 0) {
            errores.push('amountB');
        }

        // Si hay errores, mostrar mensajes específicos
        if (errores.length > 0) {
            console.error("Por favor, ingresa cantidades válidas para los tokens");
            mostrarMensajeErrorLiquidity(errores);
            return;
        }

        let toast;
        // Mostrar toast de transacción en progreso
        toast = showTransactionToast("Agregando liquidez...");

        // Convertir montos a formato wei (asumiendo 18 decimales)
        const amountAWei = ethers.parseUnits(amountA, 18);
        const amountBWei = ethers.parseUnits(amountB, 18);

        // Crear contrato con signer
        const simpleDexContract = new ethers.Contract(
            simpleDexContractAddress,
            simpleDexContractABI,
            signer
        );

        // Obtener direcciones de tokens
        const tokenAAddress = await simpleDexContract.tokenA();
        const tokenBAddress = await simpleDexContract.tokenB();

        // Crear contratos de tokens
        const tokenAContract = new ethers.Contract(tokenAAddress, ERC20_ABI, signer);
        const tokenBContract = new ethers.Contract(tokenBAddress, ERC20_ABI, signer);

        // Aprobar tokens antes de agregar liquidez
        const approveTokenATx = await tokenAContract.approve(simpleDexContractAddress, amountAWei);
        await approveTokenATx.wait();

        const approveTokenBTx = await tokenBContract.approve(simpleDexContractAddress, amountBWei);
        await approveTokenBTx.wait();

        // Llamar a la función addLiquidity del contrato
        const tx = await simpleDexContract.addLiquidity(amountAWei, amountBWei);

        // Esperar la confirmación de la transacción
        const receipt = await tx.wait();

        // Actualizar reservas, tasas de intercambio y balances
        await Promise.all([
            updateReserves(),
            updateExchangeRate(),
            updateTokenBalances()
        ]);

        // Mostrar detalles de la transacción
        showLiquidityAddTransactionDetails(receipt, amountA, amountB);

        // Registrar mensaje de éxito
        console.log("Liquidez agregada exitosamente");

        // Limpiar los campos de entrada
        document.getElementById('amountA').value = '';
        document.getElementById('amountB').value = '';

        // Registrar detalles de la transacción
        console.log("Liquidez agregada. Hash de transacción:", receipt.hash);

        // Eliminar toast de transacción
        removeTransactionToast();

    } catch (error) {
        // Manejar errores
        console.error("Error al agregar liquidez:", error);
        // Mostrar detalles específicos del error
        console.log("Error details:", {
            message: error.message,
            code: error.code,
            reason: error.reason,
            data: error.data
        });
        removeTransactionToast();
        // Mostrar toast de error
        showTransactionToast("Error al agregar liquidez", 'error');
    }
}


/**
 * Retira liquidez del pool de intercambio, devolviendo tokens A y B al usuario.
 * 
 * @async
 * @function removeLiquidity
 * @description
 * Permite al usuario retirar su liquidez previamente aportada al contrato SimpleDex.
 * Realiza validaciones de entrada, verifica el saldo de tokens de liquidez y 
 * ejecuta la transacción de retiro de liquidez.
 * 
 * @returns {Promise<void>}
 * 
 * @throws {Error}
 * - Si el contrato SimpleDex no está inicializado
 * - Si las cantidades de tokens de liquidez son inválidas
 * - Si hay saldo insuficiente de tokens de liquidez
 * - Si la transacción de retiro de liquidez falla
 * 
 * @example
 * // Retirar liquidez con cantidades específicas de Token A y Token B
 * await removeLiquidity();
 */
async function removeLiquidity() {

    try {
        // Validar que la wallet esté conectada
        if (!signer) {
            console.error("Por favor, conecta tu wallet primero");
            mostrarMensajeErrorLiquidity(['removeAmountA', 'removeAmountB']);;
            return;
        }

        // Obtener valores de los inputs
        const removeAmountA = document.getElementById('removeAmountA').value.trim();
        const removeAmountB = document.getElementById('removeAmountB').value.trim();

        // Validaciones individuales para cada token
        const errores = [];
        if (!removeAmountA || isNaN(removeAmountA) || Number(removeAmountA) <= 0) {
            errores.push('removeAmountA');
        }
        if (!removeAmountB || isNaN(removeAmountB) || Number(removeAmountB) <= 0) {
            errores.push('removeAmountB');
        }

        // Si hay errores, mostrar mensajes específicos
        if (errores.length > 0) {
            console.error("Por favor, ingresa cantidades válidas para los tokens");
            mostrarMensajeErrorLiquidity(errores);
            return;
        }

        let toast;
        // Mostrar toast de transacción en progreso
        toast = showTransactionToast("Retirando liquidez...");

        // Convertir montos a formato wei (asumiendo 18 decimales)
        const removeAmountAWei = ethers.parseUnits(removeAmountA, 18);
        const removeAmountBWei = ethers.parseUnits(removeAmountB, 18);

        // Crear contrato con signer
        const simpleDexContract = new ethers.Contract(
            simpleDexContractAddress,
            simpleDexContractABI,
            signer
        );

        // Obtener direcciones de tokens
        const tokenAAddress = await simpleDexContract.tokenA();
        const tokenBAddress = await simpleDexContract.tokenB();

        // Crear contratos de tokens
        const tokenAContract = new ethers.Contract(tokenAAddress, ERC20_ABI, signer);
        const tokenBContract = new ethers.Contract(tokenBAddress, ERC20_ABI, signer);

        // Aprobar tokens de liquidez antes de retirar
        const approveTokenATx = await tokenAContract.approve(simpleDexContractAddress, removeAmountAWei);
        await approveTokenATx.wait();

        const approveTokenBTx = await tokenBContract.approve(simpleDexContractAddress, removeAmountBWei);
        await approveTokenBTx.wait();

        // Llamar a la función removeLiquidity del contrato
        const tx = await simpleDexContract.removeLiquidity(removeAmountAWei, removeAmountBWei);

        // Esperar la confirmación de la transacción
        const receipt = await tx.wait();

        // Actualizar reservas, tasas de intercambio y balances
        await Promise.all([
            updateReserves(),
            updateExchangeRate(),
            updateTokenBalances()
        ])

        // Mostrar detalles de la transacción de retiro
        showLiquidityRemovalTransactionDetails(receipt, removeAmountA, removeAmountB);

        // Registrar mensaje de éxito
        console.log("Liquidez retirada exitosamente");

        // Limpiar los campos de entrada
        document.getElementById('removeAmountA').value = '';
        document.getElementById('removeAmountB').value = '';

        // Registrar detalles de la transacción
        console.log("Liquidez retirada. Hash de transacción:", receipt.hash);

        // Eliminar toast de transacción
        removeTransactionToast();

    } catch (error) {
        // Manejar errores
        console.error("Error al retirar liquidez:", error);

        // Mostrar detalles específicos del error
        console.log("Error details:", {
            message: error.message,
            code: error.code,
            reason: error.reason,
            data: error.data
        });

        removeTransactionToast();

        // Mostrar toast de error
        showTransactionToast("Error al retirar liquidez", 'error');
    }
}


/**
 * Muestra los detalles de una transacción de adición de liquidez.
 * 
 * @function showLiquidityAddTransactionDetails
 * @param {Object} receipt - Recibo de la transacción de adición de liquidez.
 * @param {string} amountA - Cantidad de Token A añadida al pool.
 * @param {string} amountB - Cantidad de Token B añadida al pool.
 * 
 * @description
 * Procesa y muestra información detallada sobre una transacción de adición de liquidez.
 * Incluye detalles como la dirección de la transacción, cantidades de tokens,
 * y actualiza la interfaz de usuario con la información de la transacción.
 * 
 * @returns {void}
 * 
 * @throws {Error}
 * - Si el recibo de la transacción es inválido
 * - Si hay problemas para procesar los detalles de la transacción
 * 
 * @example
 * // Mostrar detalles de una transacción de adición de liquidez
 * showLiquidityAddTransactionDetails(transactionReceipt, '100', '200');
 */
function showLiquidityAddTransactionDetails(receipt, amountA, amountB) {
    // Almacenar los detalles de la transacción
    lastLiquidityAddTransactionDetails = { receipt, amountA, amountB };

    // Crear un modal o una sección de detalles de transacción
    const transactionDetailsContainer = document.createElement('div');
    transactionDetailsContainer.id = 'liquidityTransactionDetailsModal';
    transactionDetailsContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    transactionDetailsContainer.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-md border border-white max-w-md w-full">
            <h2 class="text-2xl font-semibold text-white-800 mb-4">Detalles de Transacción</h2>
            
            <div class="mb-4">
                <p class="text-white-700">Hash de Transacción:</p>
                <p class="break-words text-blue-400">${receipt.hash}</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token A agregada:</p>
                <p class="text-green-500">${amountA} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token B agregada:</p>
                <p class="text-green-500">${amountB} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Bloque:</p>
                <p class="text-white-500">${receipt.blockNumber}</p>
            </div>
            
            <button id="closeTransactionDetails" class="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition mt-4">
                Cerrar
            </button>
        </div>
    `;

    // Eliminar cualquier modal existente
    const existingModal = document.getElementById('liquidityTransactionDetailsModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }

    // Agregar al cuerpo del documento
    document.body.appendChild(transactionDetailsContainer);

    // Agregar evento para cerrar el modal
    document.getElementById('closeTransactionDetails').addEventListener('click', () => {
        document.body.removeChild(transactionDetailsContainer);
    });
}


/**
 * Abre y muestra los detalles de la última transacción de adición de liquidez.
 * 
 * @function openLastAddLiquidityTransactionDetails
 * @description
 * Recupera y despliega la información de la última transacción de adición de liquidez
 * en un modal o sección de detalles de la interfaz de usuario.
 * Muestra información como cantidades de tokens, dirección de transacción y recibo.
 * 
 * @returns {void}
 * 
 * @throws {Error}
 * - Si no existe una transacción de liquidez previa
 * - Si hay problemas para renderizar los detalles de la transacción
 * 
 * @example
 * // Abrir los detalles de la última transacción de adición de liquidez
 * openLastAddLiquidityTransactionDetails();
 */
function openLastAddLiquidityTransactionDetails() {
    if (lastLiquidityAddTransactionDetails) {
        const { receipt, amountA, amountB } = lastLiquidityAddTransactionDetails;
        showLiquidityAddTransactionDetails(receipt, amountA, amountB);
    } else {
        console.error("No hay detalles de transacción de adición de liquidez reciente");
        mostrarMensajeNoTransaccion('addLiquidity');
    }
}


/**
 * Muestra los detalles de una transacción de retiro de liquidez.
 * 
 * @function showLiquidityRemovalTransactionDetails
 * @param {Object} receipt - Recibo de la transacción de retiro de liquidez.
 * @param {string} removeAmountA - Cantidad de Token A retirada del pool.
 * @param {string} removeAmountB - Cantidad de Token B retirada del pool.
 * 
 * @description
 * Procesa y muestra información detallada sobre una transacción de retiro de liquidez.
 * Incluye detalles como la dirección de la transacción, cantidades de tokens,
 * y actualiza la interfaz de usuario con la información de la transacción.
 * 
 * @returns {void}
 * 
 * @throws {Error}
 * - Si el recibo de la transacción es inválido
 * - Si hay problemas para procesar los detalles de la transacción
 * 
 * @example
 * // Mostrar detalles de una transacción de retiro de liquidez
 * showLiquidityRemovalTransactionDetails(transactionReceipt, '50', '75');
 */
function showLiquidityRemovalTransactionDetails(receipt, removeAmountA, removeAmountB) {
    // Almacenar los detalles de la transacción
    lastLiquidityRemovalTransactionDetails = { receipt, removeAmountA, removeAmountB };

    // Crear un modal o una sección de detalles de transacción
    const transactionDetailsContainer = document.createElement('div');
    transactionDetailsContainer.id = 'liquidityRemovalTransactionDetailsModal';
    transactionDetailsContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    transactionDetailsContainer.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-md border border-white max-w-md w-full">
            <h2 class="text-2xl font-semibold text-white-800 mb-4">Detalles de Retiro de Liquidez</h2>
            
            <div class="mb-4">
                <p class="text-white-700">Hash de Transacción:</p>
                <p class="break-words text-blue-400">${receipt.hash}</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token A retirada:</p>
                <p class="text-green-500">${removeAmountA} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token B retirada:</p>
                <p class="text-green-500">${removeAmountB} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Bloque:</p>
                <p class="text-white-500">${receipt.blockNumber}</p>
            </div>
            
            <button id="closeRemovalTransactionDetails" class="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition mt-4">
                Cerrar
            </button>
        </div>
    `;

    // Eliminar cualquier modal existente
    const existingModal = document.getElementById('liquidityRemovalTransactionDetailsModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }

    // Agregar al cuerpo del documento
    document.body.appendChild(transactionDetailsContainer);

    // Agregar evento para cerrar el modal
    document.getElementById('closeRemovalTransactionDetails').addEventListener('click', () => {
        document.body.removeChild(transactionDetailsContainer);
    });
}


/**
 * Abre y muestra los detalles de la última transacción de retiro de liquidez.
 * 
 * @function openLastLiquidityRemovalTransactionDetails
 * @description
 * Recupera y despliega la información de la última transacción de retiro de liquidez
 * en un modal o sección de detalles de la interfaz de usuario.
 * Muestra información como cantidades de tokens, dirección de transacción y recibo.
 * 
 * @returns {void}
 * 
 * @throws {Error}
 * - Si no existe una transacción de retiro de liquidez previa
 * - Si hay problemas para renderizar los detalles de la transacción
 * 
 * @example
 * // Abrir los detalles de la última transacción de retiro de liquidez
 * openLastLiquidityRemovalTransactionDetails();
 */
function openLastLiquidityRemovalTransactionDetails() {
    if (lastLiquidityRemovalTransactionDetails) {
        const { receipt, removeAmountA, removeAmountB } = lastLiquidityRemovalTransactionDetails;
        showLiquidityRemovalTransactionDetails(receipt, removeAmountA, removeAmountB);
    } else {
        console.error("No hay detalles de transacción de retiro de liquidez reciente");
        mostrarMensajeNoTransaccion('removeLiquidity');
    }
}


/**
 * Muestra los detalles de una transacción de intercambio de Token A por Token B.
 * 
 * @function showSwapAforBTransactionDetails
 * @param {Object} receipt - Recibo de la transacción de intercambio.
 * @param {string} amountAIn - Cantidad de Token A intercambiada.
 * 
 * @description
 * Procesa y muestra información detallada sobre una transacción de intercambio
 * de Token A por Token B. Incluye detalles como la dirección de la transacción,
 * cantidad de tokens intercambiados, y actualiza la interfaz de usuario.
 * 
 * @returns {void}
 * 
 * @throws {Error}
 * - Si el recibo de la transacción es inválido
 * - Si hay problemas para procesar los detalles de la transacción
 * 
 * @example
 * // Mostrar detalles de una transacción de intercambio de Token A por Token B
 * showSwapAforBTransactionDetails(transactionReceipt, '100');
 */
function showSwapAforBTransactionDetails(receipt, amountAIn) {
    // Almacenar los detalles de la transacción
    lastSwapAforBTransactionDetails = { receipt, amountAIn };

    // Crear un modal o una sección de detalles de transacción
    const transactionDetailsContainer = document.createElement('div');
    transactionDetailsContainer.id = 'swapAforBTransactionDetailsModal';
    transactionDetailsContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    transactionDetailsContainer.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-md border border-white max-w-md w-full">
            <h2 class="text-2xl font-semibold text-white-800 mb-4">Detalles de Intercambio TK-A por TK-B</h2>
            
            <div class="mb-4">
                <p class="text-white-700">Hash de Transacción:</p>
                <p class="break-words text-blue-400">${receipt.hash}</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token A intercambiada:</p>
                <p class="text-green-500">${amountAIn} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Bloque:</p>
                <p class="text-white-500">${receipt.blockNumber}</p>
            </div>
            
            <button id="closeSwapAforBTransactionDetails" class="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition mt-4">
                Cerrar
            </button>
        </div>
    `;

    // Eliminar cualquier modal existente
    const existingModal = document.getElementById('swapAforBTransactionDetailsModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }

    // Agregar al cuerpo del documento
    document.body.appendChild(transactionDetailsContainer);

    // Agregar evento para cerrar el modal
    document.getElementById('closeSwapAforBTransactionDetails').addEventListener('click', () => {
        document.body.removeChild(transactionDetailsContainer);
    });
}


/**
 * Abre y muestra los detalles de la última transacción de intercambio de Token A por Token B.
 * 
 * @function openLastSwapAforBTransactionDetails
 * @description
 * Recupera y despliega la información de la última transacción de intercambio
 * de Token A por Token B en un modal o sección de detalles de la interfaz de usuario.
 * Muestra información como cantidad de tokens intercambiados, 
 * dirección de transacción y recibo.
 * 
 * @returns {void}
 * 
 * @throws {Error}
 * - Si no existe una transacción de intercambio previa
 * - Si hay problemas para renderizar los detalles de la transacción
 * 
 * @example
 * // Abrir los detalles de la última transacción de intercambio de Token A por Token B
 * openLastSwapAforBTransactionDetails();
 */
function openLastSwapAforBTransactionDetails() {
    if (lastSwapAforBTransactionDetails) {
        const { receipt, amountAIn } = lastSwapAforBTransactionDetails;
        showSwapAforBTransactionDetails(receipt, amountAIn);
    } else {
        console.error("No hay detalles de transacción de intercambio de Token A por Token B reciente");
        mostrarMensajeNoTransaccion('swapAforB');
    }
}


/**
 * Muestra los detalles de una transacción de intercambio de Token B por Token A.
 * 
 * @function showSwapBforATransactionDetails
 * @param {Object} receipt - Recibo de la transacción de intercambio.
 * @param {string} amountBIn - Cantidad de Token B intercambiada.
 * 
 * @description
 * Procesa y muestra información detallada sobre una transacción de intercambio
 * de Token B por Token A. Incluye detalles como la dirección de la transacción,
 * cantidad de tokens intercambiados, y actualiza la interfaz de usuario.
 * 
 * @returns {void}
 * 
 * @throws {Error}
 * - Si el recibo de la transacción es inválido
 * - Si hay problemas para procesar los detalles de la transacción
 * 
 * @example
 * // Mostrar detalles de una transacción de intercambio de Token B por Token A
 * showSwapBforATransactionDetails(transactionReceipt, '100');
 */
function showSwapBforATransactionDetails(receipt, amountBIn) {
    // Almacenar los detalles de la transacción
    lastSwapBforATransactionDetails = { receipt, amountBIn };

    // Crear un modal o una sección de detalles de transacción
    const transactionDetailsContainer = document.createElement('div');
    transactionDetailsContainer.id = 'swapBforATransactionDetailsModal';
    transactionDetailsContainer.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    transactionDetailsContainer.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg shadow-md border border-white max-w-md w-full">
            <h2 class="text-2xl font-semibold text-white-800 mb-4">Detalles de Intercambio TK-B por TK-A</h2>
            
            <div class="mb-4">
                <p class="text-white-700">Hash de Transacción:</p>
                <p class="break-words text-blue-400">${receipt.hash}</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Cantidad de Token B intercambiada:</p>
                <p class="text-green-500">${amountBIn} Tokens</p>
            </div>
            
            <div class="mb-4">
                <p class="text-white-700">Bloque:</p>
                <p class="text-white-500">${receipt.blockNumber}</p>
            </div>
            
            <button id="closeSwapBforATransactionDetails" class="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition mt-4">
                Cerrar
            </button>
        </div>
    `;

    // Eliminar cualquier modal existente
    const existingModal = document.getElementById('swapBforATransactionDetailsModal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }

    // Agregar al cuerpo del documento
    document.body.appendChild(transactionDetailsContainer);

    // Agregar evento para cerrar el modal
    document.getElementById('closeSwapBforATransactionDetails').addEventListener('click', () => {
        document.body.removeChild(transactionDetailsContainer);
    });
}


/**
 * Abre y muestra los detalles de la última transacción de intercambio de Token B por Token A.
 * 
 * @function openLastSwapBforATransactionDetails
 * @description
 * Recupera y despliega la información de la última transacción de intercambio
 * de Token B por Token A en un modal o sección de detalles de la interfaz de usuario.
 * Muestra información como cantidad de tokens intercambiados, 
 * dirección de transacción y recibo.
 * 
 * @returns {void}
 * 
 * @throws {Error}
 * - Si no existe una transacción de intercambio previa
 * - Si hay problemas para renderizar los detalles de la transacción
 * 
 * @example
 * // Abrir los detalles de la última transacción de intercambio de Token B por Token A
 * openLastSwapBforATransactionDetails();
 */
function openLastSwapBforATransactionDetails() {
    if (lastSwapBforATransactionDetails) {
        const { receipt, amountBIn } = lastSwapBforATransactionDetails;
        showSwapBforATransactionDetails(receipt, amountBIn);
    } else {
        console.error("No hay detalles de transacción de intercambio de Token B por Token A reciente");
        mostrarMensajeNoTransaccion('swapBforA');
    }
}


/**
 * Muestra un toast (mensaje emergente) para informar al usuario sobre el estado de una transacción.
 * 
 * @function showTransactionToast
 * @param {string} message - Mensaje a mostrar en el toast.
 * @param {'info'|'success'|'error'|'swap'} [type='info'] - Tipo de toast que determina su estilo visual.
 * @returns {HTMLElement} Elemento del toast creado o actualizado.
 * 
 * @description 
 * Crea o actualiza un elemento toast en la interfaz con estilos dinámicos según el tipo de mensaje.
 * Soporta diferentes tipos de notificaciones como información, éxito, error o intercambio.
 * 
 * @example
 * // Mostrar un toast de error
 * showTransactionToast('Error en la transacción', 'error');
 * 
 * // Mostrar un toast de información
 * showTransactionToast('Procesando transacción', 'info');
 */
function showTransactionToast(message, type = 'info') {
    // Verificar si ya existe un toast
    let existingToast = document.getElementById('transactionToast');

    // Limpiar cualquier temporizador existente
    if (existingToast && existingToast.timeoutId) {
        clearTimeout(existingToast.timeoutId);
    }

    // Actualizar el mensaje y el tipo del toast existente
    if (existingToast) {
        // Clases base y de estilo según el tipo
        const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ease-in-out';
        const typeClasses = {
            'info': 'bg-teal-500 text-white',
            'success': 'bg-green-500 text-white',
            'error': 'bg-red-500 text-white',
            'swap': 'bg-violet-500 text-white'
        };

        // Aplicar clases según el tipo, con fallback a 'info'
        existingToast.className = `${baseClasses} ${typeClasses[type] || typeClasses['info']}`;

        // Actualizar contenido del toast con ícono animado
        existingToast.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">${message}</span>
                <div class="animate-spin">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </div>
            </div>
        `;
    } else {
        // Crear el elemento del toast si no existe
        existingToast = document.createElement('div');
        existingToast.id = 'transactionToast';

        // Clases base y de estilo según el tipo
        const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ease-in-out';
        const typeClasses = {
            'info': 'bg-teal-500 text-white',
            'success': 'bg-green-500 text-white',
            'error': 'bg-red-500 text-white',
            'swap': 'bg-violet-500 text-white'
        };

        // Aplicar clases según el tipo, con fallback a 'info'
        existingToast.className = `${baseClasses} ${typeClasses[type] || typeClasses['info']}`;

        // Contenido del toast con ícono animado
        existingToast.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">${message}</span>
                <div class="animate-spin">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </div>
            </div>
        `;

        // Agregar al cuerpo del documento
        document.body.appendChild(existingToast);
    }

    // Establecer temporizador para eliminar toast de error
    if (type === 'error') {
        existingToast.timeoutId = setTimeout(() => {
            removeTransactionToast();
        }, 3500);
    }

    return existingToast;
}


/**
 * Elimina el toast (mensaje emergente) de transacción actual de la interfaz.
 * 
 * @function removeTransactionToast
 * @description 
 * Busca y remueve el elemento de toast existente del documento.
 * Se utiliza para limpiar mensajes transitorios después de completar una acción.
 * 
 * @returns {void}
 * 
 * @example
 * // Eliminar el toast de transacción actual
 * removeTransactionToast();
 */
function removeTransactionToast() {
    const existingToast = document.getElementById('transactionToast');
    if (existingToast) {
        existingToast.remove();
    }
}


/**
 * Muestra un mensaje de error específico para operaciones de intercambio de tokens.
 * 
 * @function mostrarMensajeErrorSwap
 * @param {string} mensaje - Texto descriptivo del error ocurrido.
 * @param {string} inputId - Identificador del elemento de input relacionado con el error.
 * 
 * @description
 * Crea y muestra un mensaje de error asociado a un campo de input específico.
 * El mensaje se estiliza con colores de error y se puede eliminar al hacer foco en el input.
 * 
 * @returns {void}
 * 
 * @example
 * // Mostrar error en el input de cantidad de Token A
 * mostrarMensajeErrorSwap('Cantidad de Token A inválida', 'amountAIn');
 */
function mostrarMensajeErrorSwap(mensaje, inputId) {
    // Eliminar cualquier mensaje de error existente
    const existingErrorElement = document.getElementById(`${inputId}Error`);
    if (existingErrorElement) {
        existingErrorElement.remove();
    }

    // Crear elemento de error
    const errorElement = document.createElement('div');
    errorElement.id = `${inputId}Error`;
    errorElement.className = 'text-red-500 text-sm mt-2';
    errorElement.textContent = mensaje;

    // Encontrar el contenedor del input
    const inputContainer = document.getElementById(inputId).parentNode;
    inputContainer.appendChild(errorElement);

    // Agregar eliminación automática después de 3 segundos
    // setTimeout(() => {
    //     if (errorElement && errorElement.parentNode) {
    //         errorElement.remove();
    //     }
    // }, 3000);

    // Agregar evento para limpiar el mensaje cuando se haga foco en el input
    const inputElement = document.getElementById(inputId);
    const clearErrorHandler = () => {
        errorElement.remove();
        inputElement.removeEventListener('focus', clearErrorHandler);
    };
    inputElement.addEventListener('focus', clearErrorHandler);
}


/**
 * Muestra mensajes de error para operaciones de liquidez con tokens.
 * 
 * @function mostrarMensajeErrorLiquidity
 * @param {string[]} inputIds - Arreglo de identificadores de inputs con errores.
 * 
 * @description
 * Genera y muestra mensajes de error personalizados para diferentes campos 
 * relacionados con la adición o retiro de liquidez.
 * Cada mensaje de error se asocia a un input específico y se puede eliminar al hacer foco.
 * 
 * @returns {void}
 * 
 * @example
 * // Mostrar errores en inputs de cantidad de Token A y B
 * mostrarMensajeErrorLiquidity(['amountA', 'amountB']);
 * 
 * // Mostrar error en input de retiro de Token A
 * mostrarMensajeErrorLiquidity(['removeAmountA']);
 */
function mostrarMensajeErrorLiquidity(inputIds) {
    inputIds.forEach(inputId => {
        let mensaje = '';

        // Determinar mensaje específico según el input
        switch (inputId) {
            case 'amountA':
                mensaje = "Por favor, ingresa una cantidad válida para el Token A";
                break;
            case 'amountB':
                mensaje = "Por favor, ingresa una cantidad válida para el Token B";
                break;
            case 'removeAmountA':
                mensaje = "Por favor, ingresa una cantidad válida para retirar Token A";
                break;
            case 'removeAmountB':
                mensaje = "Por favor, ingresa una cantidad válida para retirar Token B";
                break;
        }

        // Eliminar cualquier mensaje de error existente
        const existingErrorElement = document.getElementById(`${inputId}Error`);
        if (existingErrorElement) {
            existingErrorElement.remove();
        }

        // Crear elemento de error
        const errorElement = document.createElement('div');
        errorElement.id = `${inputId}Error`;
        errorElement.className = 'text-red-500 text-sm mt-2';
        errorElement.textContent = mensaje;

        // Encontrar el contenedor del input
        const inputContainer = document.getElementById(inputId).parentNode;
        inputContainer.appendChild(errorElement);

        // Agregar eliminación automática después de 3 segundos
        // setTimeout(() => {
        //     if (errorElement && errorElement.parentNode) {
        //         errorElement.remove();
        //     }
        // }, 3000);

        // Agregar evento para limpiar el mensaje cuando se haga foco en el input
        const inputElement = document.getElementById(inputId);
        const clearErrorHandler = () => {
            errorElement.remove();
            inputElement.removeEventListener('focus', clearErrorHandler);
        };
        inputElement.addEventListener('focus', clearErrorHandler);
    });
}


/**
 * Muestra un mensaje cuando no existen transacciones previas para una operación específica.
 * 
 * @function mostrarMensajeNoTransaccion
 * @param {string} tipoTransaccion - Tipo de transacción sin historial previo.
 * 
 * @description
 * Genera un mensaje informativo cuando el usuario intenta acceder a detalles 
 * de transacciones anteriores, pero no existe un historial para la operación seleccionada.
 * 
 * @returns {void}
 * 
 * @example
 * // Mostrar mensaje para transacción de adición de liquidez sin historial
 * mostrarMensajeNoTransaccion('addLiquidity');
 * 
 * // Mostrar mensaje para transacción de intercambio sin historial
 * mostrarMensajeNoTransaccion('swapAforB');
 */
function mostrarMensajeNoTransaccion(tipoTransaccion) {
    // Eliminar cualquier mensaje de error existente
    const existingErrorElement = document.getElementById('noTransactionError');
    if (existingErrorElement) {
        existingErrorElement.remove();
    }

    // Crear elemento de error
    const errorElement = document.createElement('div');
    errorElement.id = 'noTransactionError';
    // errorElement.className = 'fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg bg-orange-500 text-white';
    errorElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg bg-orange-500 text-white';


    // Mensajes personalizados según el tipo de transacción
    const mensajes = {
        'swapAforB': "No hay transacciones previas de intercambio de Token A por Token B",
        'swapBforA': "No hay transacciones previas de intercambio de Token B por Token A",
        'addLiquidity': "No hay transacciones previas de adición de liquidez",
        'removeLiquidity': "No hay transacciones previas de retiro de liquidez"
    };

    errorElement.textContent = mensajes[tipoTransaccion] || "No hay transacciones previas";

    // Agregar al cuerpo del documento
    document.body.appendChild(errorElement);

    // Eliminar el mensaje después de 3 segundos
    setTimeout(() => {
        if (errorElement.parentNode) {
            document.body.removeChild(errorElement);
        }
    }, 3500);
}


// Estoy buscando el "btnConnect" y le estoy diciendo que cuando se haga click, se ejecute la función "connectWallet"
document.getElementById("btnConnect").addEventListener("click", connectWallet);
// Agregamos el event listener para el botón de obtener precio
document.getElementById("btnGetPrice").addEventListener("click", getTokenPrice);
// Estoy buscando el "btnDisconnect" y le estoy diciendo que cuando se haga click, se ejecute la función "disconnectWallet"
document.getElementById("btnDisconnect").addEventListener("click", disconnectWallet);
// Estoy buscando el "btnClearPrice" y le estoy diciendo que cuando se haga click, se ejecute la función "clearTokenPrice"
document.getElementById("btnClearPrice").addEventListener("click", clearTokenPrice);
// Agregamos el event listener para los botones de intercambio
document.getElementById("btnSwapAforB").addEventListener("click", swapTokenAforB);
document.getElementById("btnSwapBforA").addEventListener("click", swapTokenBforA);


// Agregar event listener al botón de agregar liquidez
document.getElementById("btnAddLiquidity").addEventListener("click", addLiquidity);
// Agregar event listener al botón de mostrar última transacción de agregar liquidez
document.getElementById('btnShowLastAddLiquidityTransaction').addEventListener('click', openLastAddLiquidityTransactionDetails);

// Agregar event listener al botón de retirar liquidez
document.getElementById("btnRemoveLiquidity").addEventListener("click", removeLiquidity);
// Agregar event listener al botón de mostrar última transacción de retiro de liquidez
document.getElementById('btnShowLastLiquidityTransaction').addEventListener('click', openLastLiquidityRemovalTransactionDetails);

// Agregar event listener al botón de mostrar última transacción de intercambio de Token A por Token B
document.getElementById('btnShowLastSwapAforBTransaction').addEventListener('click', openLastSwapAforBTransactionDetails);
// Agregar event listener al botón de mostrar última transacción de intercambio de Token B por Token A
document.getElementById('btnShowLastSwapBforATransaction').addEventListener('click', openLastSwapBforATransactionDetails);

// Llama a toggleAnimations cuando cambie el estado de la wallet
document.getElementById('btnConnect').addEventListener('click', () => {
    // Añade una clase para indicar que la wallet está conectada
    document.getElementById('walletStatusSection').classList.add('wallet-connected');
    toggleAnimations();
});
// Elimina la clase cuando se desconecta
document.getElementById('btnDisconnect').addEventListener('click', () => {
    document.getElementById('walletStatusSection').classList.remove('wallet-connected');
    toggleAnimations();
});

// Llamar inicialmente para establecer el estado correcto
toggleAnimations();